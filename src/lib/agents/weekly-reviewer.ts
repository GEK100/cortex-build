import { createAdminClient } from '@/lib/supabase/admin'
import { MODELS } from '@/lib/config'
import { startRun, finishRun, saveOutput, agentAnthropic, textOf, tokensOf } from './runner'

const SYSTEM = `You are the weekly reviewer — the chief of staff — for a single construction project manager running a commercially and reputationally sensitive subcontract. Once a week you read everything that happened and produce the review he reads on Sunday evening before the week ahead.

Produce three parts, in quiet, precise British-English prose (headed sections are fine here, but no bullet-salad within them):

1. The week just gone — what actually moved, what slipped, and what is quietly drifting. Be honest; name the things he may be avoiding.
2. The week ahead — what matters, what to prepare for, where the risk is.
3. Two or three explicit proposals. Each framed as "here are the options for handling X — I'd recommend Y, because …". These are the reason this review exists: give him decisions to make, not just a summary.

Everything you say must be grounded in the supplied material. Where you infer, say you are inferring. Do not invent facts, names, or commitments.`

interface WeekData {
  events: { headline: string; labels: string[]; when: string }[]
  actionsClosed: number
  actionsOpened: number
  actionsOverdue: { description: string; due: string }[]
  decisions: { statement: string; status: string }[]
  meetings: { summary: string | null; starts_at: string }[]
  gapReports: string[]
}

async function gather(userId: string): Promise<WeekData> {
  const admin = createAdminClient()
  const now = Date.now()
  const weekAgo = new Date(now - 7 * 86400_000).toISOString()
  const weekAhead = new Date(now + 7 * 86400_000).toISOString()
  const nowIso = new Date(now).toISOString()

  const [eventsRes, closedRes, openedRes, overdueRes, decisionsRes, meetingsRes, gapsRes] =
    await Promise.all([
      admin
        .from('events')
        .select('captured_at, event_labels(label), extraction_results(timeline_headline, parsed_result, significance)')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .gte('captured_at', weekAgo)
        .order('captured_at', { ascending: true }),
      admin
        .from('actions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'closed')
        .gte('closed_at', weekAgo),
      admin
        .from('actions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('raised_at', weekAgo),
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
        .select('statement, status')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .gte('decided_at', weekAgo),
      admin
        .from('calendar_events')
        .select('summary, starts_at')
        .eq('user_id', userId)
        .eq('is_cancelled', false)
        .gte('starts_at', nowIso)
        .lte('starts_at', weekAhead)
        .order('starts_at', { ascending: true }),
      admin
        .from('agent_outputs')
        .select('body')
        .eq('user_id', userId)
        .eq('kind', 'gap_report')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

  const events = ((eventsRes.data ?? []) as unknown as {
    captured_at: string
    event_labels: { label: string }[]
    extraction_results: { timeline_headline: string | null; parsed_result: { summary?: string } | null; significance: number | null }[]
  }[])
    .filter((e) => (e.extraction_results?.[0]?.significance ?? 1) >= 2)
    .map((e) => ({
      headline: e.extraction_results?.[0]?.timeline_headline || e.extraction_results?.[0]?.parsed_result?.summary || '(capture)',
      labels: (e.event_labels ?? []).map((l) => l.label),
      when: e.captured_at.slice(0, 10),
    }))

  return {
    events,
    actionsClosed: closedRes.count ?? 0,
    actionsOpened: openedRes.count ?? 0,
    actionsOverdue: (overdueRes.data ?? []).map((a: { description: string; due_at: string }) => ({
      description: a.description,
      due: a.due_at,
    })),
    decisions: (decisionsRes.data ?? []).map((d: { statement: string; status: string }) => ({
      statement: d.statement,
      status: d.status,
    })),
    meetings: (meetingsRes.data ?? []).map((m: { summary: string | null; starts_at: string }) => ({
      summary: m.summary,
      starts_at: m.starts_at,
    })),
    gapReports: (gapsRes.data ?? []).map((g: { body: string }) => g.body),
  }
}

function buildPrompt(w: WeekData): string {
  const lines: string[] = []
  lines.push(`This week's notable captures (${w.events.length}):`)
  w.events.slice(0, 80).forEach((e) => lines.push(`- ${e.when} [${e.labels.join(', ') || 'unlabelled'}] ${e.headline}`))
  lines.push(`\nActions: ${w.actionsClosed} closed, ${w.actionsOpened} raised this week, ${w.actionsOverdue.length} currently overdue.`)
  w.actionsOverdue.slice(0, 20).forEach((a) => lines.push(`  overdue: ${a.description} (due ${a.due.slice(0, 10)})`))
  lines.push(`\nDecisions this week (${w.decisions.length}):`)
  w.decisions.forEach((d) => lines.push(`- [${d.status}] ${d.statement}`))
  lines.push(`\nMeetings in the coming week (${w.meetings.length}):`)
  w.meetings.forEach((m) => lines.push(`- ${m.summary || '(untitled)'} on ${m.starts_at.slice(0, 10)}`))
  if (w.gapReports.length) {
    lines.push('\nRecent drift observations:')
    w.gapReports.forEach((g) => lines.push(g))
  }
  lines.push('\nWrite the weekly review.')
  return lines.join('\n')
}

/** Weekly reviewer — the only Opus caller (build prompt §3.6). Sunday 20:00. */
export async function runWeeklyReviewer(userId: string): Promise<{ body: string }> {
  const runId = await startRun(userId, 'weekly_reviewer')
  const started = Date.now()
  try {
    const w = await gather(userId)
    const msg = await agentAnthropic.messages.create({
      model: MODELS.opus,
      max_tokens: 2500,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPrompt(w) }],
    })
    const body = textOf(msg)

    // Key to the ISO date of this Sunday's run.
    const today = new Date().toISOString().slice(0, 10)
    await saveOutput(userId, 'weekly_review', today, {
      title: `Weekly review — ${today}`,
      body,
      data: {
        capturesReviewed: w.events.length,
        actionsClosed: w.actionsClosed,
        actionsOpened: w.actionsOpened,
        overdue: w.actionsOverdue.length,
      },
      runId,
    })

    await finishRun(runId, {
      status: 'complete',
      model: MODELS.opus,
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
