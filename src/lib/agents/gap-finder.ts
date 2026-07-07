import { createAdminClient } from '@/lib/supabase/admin'
import { MODELS } from '@/lib/config'
import { startRun, finishRun, saveOutput, agentAnthropic, textOf, tokensOf } from './runner'

const SYSTEM = `You are the gap-finder for a single construction project manager. You are given a deterministic scan of things that may be drifting: stakeholders who have gone quiet, actions overdue, decisions recorded but never operationalised, and meetings approaching without preparation.

Your job is judgement, not listing. Pick out what genuinely warrants attention and say why, in quiet British-English prose. Distinguish real drift from noise — a stakeholder you last spoke to a fortnight ago may be fine; an overdue commitment to McAlpine is not. Do not manufacture anxiety, and do not pad. If nothing meaningful is drifting, say so in a sentence. Never invent items beyond those in the scan.`

// The scan is deterministic (cheaper and more reliable than an LLM pass — the
// spec's "Haiku for the scan" intent is met by doing it in code); Sonnet then
// exercises judgement over the narrative. Documented in DECISIONS as AD-019.
const SILENCE_DAYS = 14
const STALE_DECISION_DAYS = 14

interface Scan {
  silentStakeholders: { name: string; type: string; lastContact: string }[]
  overdueActions: { description: string; due: string }[]
  staleDecisions: { statement: string; decidedAt: string }[]
  unpreparedMeetings: { summary: string | null; starts_at: string }[]
}

async function scan(userId: string): Promise<Scan> {
  const admin = createAdminClient()
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const silenceCutoff = new Date(now - SILENCE_DAYS * 86400_000).toISOString()
  const staleCutoff = new Date(now - STALE_DECISION_DAYS * 86400_000).toISOString()
  const in7days = new Date(now + 7 * 86400_000).toISOString()

  const [entitiesRes, actionsRes, decisionsRes, meetingsRes] = await Promise.all([
    admin
      .from('entities')
      .select('canonical_name, entity_type, event_entities(events(captured_at, is_deleted))')
      .eq('user_id', userId)
      .in('entity_type', ['person', 'organisation']),
    admin
      .from('actions')
      .select('description, due_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('status', 'open')
      .not('due_at', 'is', null)
      .lt('due_at', nowIso),
    admin
      .from('decisions')
      .select('statement, decided_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('status', 'recorded')
      .lt('decided_at', staleCutoff),
    admin
      .from('calendar_events')
      .select('summary, starts_at, context_event_id')
      .eq('user_id', userId)
      .eq('is_cancelled', false)
      .is('context_event_id', null)
      .gte('starts_at', nowIso)
      .lte('starts_at', in7days),
  ])

  const silentStakeholders: Scan['silentStakeholders'] = []
  for (const e of entitiesRes.data ?? []) {
    const row = e as unknown as {
      canonical_name: string
      entity_type: string
      event_entities: { events: { captured_at: string; is_deleted: boolean } | null }[]
    }
    const contacts = (row.event_entities ?? [])
      .map((j) => j.events)
      .filter((ev): ev is { captured_at: string; is_deleted: boolean } => !!ev && !ev.is_deleted)
      .map((ev) => ev.captured_at)
      .sort()
    if (contacts.length === 0) continue // never contacted — not "silence"
    const last = contacts[contacts.length - 1]
    if (last < silenceCutoff) {
      silentStakeholders.push({ name: row.canonical_name, type: row.entity_type, lastContact: last })
    }
  }

  return {
    silentStakeholders,
    overdueActions: (actionsRes.data ?? []).map((a: { description: string; due_at: string }) => ({
      description: a.description,
      due: a.due_at,
    })),
    staleDecisions: (decisionsRes.data ?? []).map((d: { statement: string; decided_at: string }) => ({
      statement: d.statement,
      decidedAt: d.decided_at,
    })),
    unpreparedMeetings: (meetingsRes.data ?? []).map((m: { summary: string | null; starts_at: string }) => ({
      summary: m.summary,
      starts_at: m.starts_at,
    })),
  }
}

function buildPrompt(s: Scan): string {
  const lines: string[] = []
  lines.push(`Stakeholders silent >${SILENCE_DAYS} days (${s.silentStakeholders.length}):`)
  s.silentStakeholders.forEach((x) => lines.push(`- ${x.name} (${x.type}), last contact ${x.lastContact.slice(0, 10)}`))
  lines.push(`\nOverdue actions (${s.overdueActions.length}):`)
  s.overdueActions.forEach((a) => lines.push(`- ${a.description} (due ${a.due.slice(0, 10)})`))
  lines.push(`\nDecisions recorded but not operationalised >${STALE_DECISION_DAYS} days (${s.staleDecisions.length}):`)
  s.staleDecisions.forEach((d) => lines.push(`- ${d.statement} (decided ${d.decidedAt.slice(0, 10)})`))
  lines.push(`\nMeetings within 7 days with no preparation note (${s.unpreparedMeetings.length}):`)
  s.unpreparedMeetings.forEach((m) => lines.push(`- ${m.summary || '(untitled)'} on ${m.starts_at.slice(0, 10)}`))
  lines.push('\nWrite the drift assessment.')
  return lines.join('\n')
}

export async function runGapFinder(userId: string): Promise<{ body: string }> {
  const runId = await startRun(userId, 'gap_finder')
  const started = Date.now()
  try {
    const s = await scan(userId)
    const total =
      s.silentStakeholders.length + s.overdueActions.length + s.staleDecisions.length + s.unpreparedMeetings.length

    const msg = await agentAnthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 900,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPrompt(s) }],
    })
    const body = textOf(msg)

    const today = new Date().toISOString().slice(0, 10)
    await saveOutput(userId, 'gap_report', today, {
      title: `Drift report ${today}`,
      body,
      data: {
        silent: s.silentStakeholders.length,
        overdue: s.overdueActions.length,
        staleDecisions: s.staleDecisions.length,
        unpreparedMeetings: s.unpreparedMeetings.length,
        total,
      },
      runId,
    })

    await finishRun(runId, {
      status: 'complete',
      model: MODELS.sonnet,
      tokensUsed: tokensOf(msg),
      latencyMs: Date.now() - started,
    })
    return { body }
  } catch (err) {
    await finishRun(runId, {
      status: 'failed',
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : 'unknown',
    })
    throw err
  }
}
