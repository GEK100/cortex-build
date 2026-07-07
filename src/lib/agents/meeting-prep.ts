import { createAdminClient } from '@/lib/supabase/admin'
import { MODELS } from '@/lib/config'
import { startRun, finishRun, saveOutput, agentAnthropic, textOf, tokensOf } from './runner'

const SYSTEM = `You are the meeting-prep agent for a single construction project manager. Ninety minutes before a meeting you produce a short brief so he walks in prepared.

Cover, in quiet British-English prose: who he is meeting and their role; when they last spoke and the tenor of it; his outstanding commitments to them and theirs to him; open actions and RFIs between them; and anything recently captured that bears on this meeting. If he left a context note against the meeting, lead with what it asks him to do. Keep it to a few tight paragraphs he can read in the lift. Never invent facts — work only from the supplied material.`

interface Prep {
  summary: string | null
  startsAt: string
  location: string | null
  attendees: { email?: string; displayName?: string }[]
  contextNote: string | null
  people: {
    name: string
    recentEvents: string[]
    openActions: { description: string; due: string | null; kind: string; ownedByThem: boolean }[]
  }[]
}

async function gather(userId: string, meetingId: string): Promise<Prep | null> {
  const admin = createAdminClient()
  const { data: meeting } = await admin
    .from('calendar_events')
    .select('summary, starts_at, location, attendees, context_event_id')
    .eq('id', meetingId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!meeting) return null

  let contextNote: string | null = null
  if (meeting.context_event_id) {
    const { data: ctx } = await admin
      .from('events')
      .select('raw_content, edited_content')
      .eq('id', meeting.context_event_id)
      .maybeSingle()
    contextNote = ctx?.edited_content || ctx?.raw_content || null
  }

  const attendees = (meeting.attendees ?? []) as { email?: string; displayName?: string }[]
  const names = attendees.map((a) => a.displayName).filter(Boolean) as string[]

  // Match attendees to known entities by name (case-insensitive contains).
  const people: Prep['people'] = []
  if (names.length > 0) {
    const { data: entities } = await admin
      .from('entities')
      .select('id, canonical_name')
      .eq('user_id', userId)
      .in('entity_type', ['person', 'organisation'])

    for (const name of names) {
      const match = (entities ?? []).find(
        (e: { id: string; canonical_name: string }) =>
          e.canonical_name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(e.canonical_name.toLowerCase())
      )
      if (!match) {
        people.push({ name, recentEvents: [], openActions: [] })
        continue
      }

      const since = new Date(Date.now() - 60 * 86400_000).toISOString()
      const [eventsRes, actionsRes] = await Promise.all([
        admin
          .from('event_entities')
          .select('events(captured_at, is_deleted, extraction_results(timeline_headline, parsed_result))')
          .eq('entity_id', match.id)
          .limit(30),
        admin
          .from('actions')
          .select('description, due_at, source_kind, owner_entity_id, raised_by_entity_id')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .eq('status', 'open')
          .or(`owner_entity_id.eq.${match.id},raised_by_entity_id.eq.${match.id}`),
      ])

      const recentEvents = ((eventsRes.data ?? []) as unknown as {
        events: {
          captured_at: string
          is_deleted: boolean
          extraction_results: { timeline_headline: string | null; parsed_result: { summary?: string } | null }[]
        } | null
      }[])
        .map((j) => j.events)
        .filter((ev): ev is NonNullable<typeof ev> => !!ev && !ev.is_deleted && ev.captured_at >= since)
        .map((ev) => ev.extraction_results?.[0]?.timeline_headline || ev.extraction_results?.[0]?.parsed_result?.summary || '')
        .filter(Boolean)
        .slice(0, 8)

      const openActions = (actionsRes.data ?? []).map(
        (a: { description: string; due_at: string | null; source_kind: string; owner_entity_id: string | null }) => ({
          description: a.description,
          due: a.due_at,
          kind: a.source_kind,
          ownedByThem: a.owner_entity_id === match.id,
        })
      )

      people.push({ name: match.canonical_name, recentEvents, openActions })
    }
  }

  return {
    summary: meeting.summary,
    startsAt: meeting.starts_at,
    location: meeting.location,
    attendees,
    contextNote,
    people,
  }
}

function buildPrompt(p: Prep): string {
  const lines: string[] = []
  lines.push(`Meeting: ${p.summary || '(untitled)'} at ${p.startsAt.slice(0, 16).replace('T', ' ')}${p.location ? `, ${p.location}` : ''}`)
  if (p.contextNote) lines.push(`\nYour context note for this meeting: "${p.contextNote}"`)
  lines.push(`\nAttendees: ${p.attendees.map((a) => a.displayName || a.email).filter(Boolean).join(', ') || '(none listed)'}`)

  for (const person of p.people) {
    lines.push(`\n--- ${person.name} ---`)
    if (person.recentEvents.length) {
      lines.push('Recent, relevant:')
      person.recentEvents.forEach((e) => lines.push(`  - ${e}`))
    }
    if (person.openActions.length) {
      lines.push('Open items:')
      person.openActions.forEach((a) =>
        lines.push(`  - [${a.kind}] ${a.description}${a.due ? ` (due ${a.due.slice(0, 10)})` : ''} — ${a.ownedByThem ? 'theirs to deliver' : 'yours to deliver'}`)
      )
    }
    if (!person.recentEvents.length && !person.openActions.length) {
      lines.push('(no prior captured history)')
    }
  }

  lines.push('\nWrite the pre-meeting brief.')
  return lines.join('\n')
}

export async function runMeetingPrep(
  userId: string,
  meetingId: string
): Promise<{ body: string; title: string } | null> {
  const runId = await startRun(userId, 'meeting_prep')
  const started = Date.now()
  try {
    const prep = await gather(userId, meetingId)
    if (!prep) {
      await finishRun(runId, { status: 'failed', error: 'meeting not found' })
      return null
    }

    const msg = await agentAnthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 900,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPrompt(prep) }],
    })
    const body = textOf(msg)
    const title = `Prep: ${prep.summary || 'meeting'}`

    await saveOutput(userId, 'meeting_prep', meetingId, {
      title,
      body,
      data: { startsAt: prep.startsAt, attendees: prep.attendees.length },
      runId,
      refId: meetingId,
    })

    // Mark dispatched so the cron does not re-prep this meeting.
    const admin = createAdminClient()
    await admin
      .from('calendar_events')
      .update({ prep_sent_at: new Date().toISOString() })
      .eq('id', meetingId)

    await finishRun(runId, {
      status: 'complete',
      model: MODELS.sonnet,
      tokensUsed: tokensOf(msg),
      latencyMs: Date.now() - started,
    })
    return { body, title }
  } catch (err) {
    await finishRun(runId, {
      status: 'failed',
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : 'unknown',
    })
    throw err
  }
}
