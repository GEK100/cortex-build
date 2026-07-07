import { createAdminClient } from '@/lib/supabase/admin'
import { MODELS } from '@/lib/config'
import { startRun, finishRun, saveOutput, agentAnthropic, textOf, tokensOf } from './runner'

const SYSTEM = `You are the overnight synthesiser for a single construction project manager's second brain. At 22:00 you read the day's captures and the state of the project, and you write the brief he reads first thing tomorrow morning.

Write in British English, in quiet, dense prose — not bullet salad. Lead with what genuinely matters tomorrow: meetings he must prepare for, actions overdue or due, and one or two "you should know" observations drawn from today's captures. Be specific and short. If something failed to process, flag it plainly so he can re-capture. If the day was quiet, say so in a sentence rather than padding. Never invent facts not present in the data.`

interface Gathered {
  todaysEvents: { headline: string; labels: string[] }[]
  overdue: { description: string; due: string | null }[]
  dueSoon: { description: string; due: string | null }[]
  meetings: { summary: string | null; starts_at: string; hasContext: boolean }[]
  failedCount: number
}

async function gather(userId: string): Promise<Gathered> {
  const admin = createAdminClient()
  const now = new Date()
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString()
  const in2days = new Date(now.getTime() + 2 * 86400_000).toISOString()
  const in3days = new Date(now.getTime() + 3 * 86400_000).toISOString()

  const [eventsRes, actionsRes, meetingsRes, failedRes] = await Promise.all([
    admin
      .from('events')
      .select('id, extraction_results(timeline_headline, parsed_result), event_labels(label)')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('captured_at', startOfToday),
    admin
      .from('actions')
      .select('description, due_at, status')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('status', 'open'),
    admin
      .from('calendar_events')
      .select('summary, starts_at, context_event_id')
      .eq('user_id', userId)
      .eq('is_cancelled', false)
      .gte('starts_at', now.toISOString())
      .lte('starts_at', in2days)
      .order('starts_at', { ascending: true }),
    admin
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('extraction_status', 'failed')
      .gte('captured_at', startOfToday),
  ])

  const todaysEvents = (eventsRes.data ?? []).map(
    (e: {
      extraction_results: { timeline_headline: string | null; parsed_result: { summary?: string } | null }[]
      event_labels: { label: string }[]
    }) => ({
      headline:
        e.extraction_results?.[0]?.timeline_headline ||
        e.extraction_results?.[0]?.parsed_result?.summary ||
        '(unprocessed capture)',
      labels: (e.event_labels ?? []).map((l) => l.label),
    })
  )

  const nowIso = now.toISOString()
  const overdue: Gathered['overdue'] = []
  const dueSoon: Gathered['dueSoon'] = []
  for (const a of actionsRes.data ?? []) {
    const row = a as { description: string; due_at: string | null }
    if (row.due_at && row.due_at < nowIso) overdue.push({ description: row.description, due: row.due_at })
    else if (row.due_at && row.due_at <= in3days) dueSoon.push({ description: row.description, due: row.due_at })
  }

  const meetings = (meetingsRes.data ?? []).map(
    (m: { summary: string | null; starts_at: string; context_event_id: string | null }) => ({
      summary: m.summary,
      starts_at: m.starts_at,
      hasContext: !!m.context_event_id,
    })
  )

  return { todaysEvents, overdue, dueSoon, meetings, failedCount: (failedRes.data ?? []).length }
}

function buildPrompt(g: Gathered): string {
  const lines: string[] = []
  lines.push(`Today's captures (${g.todaysEvents.length}):`)
  g.todaysEvents.slice(0, 40).forEach((e) => lines.push(`- [${e.labels.join(', ') || 'unlabelled'}] ${e.headline}`))
  if (g.todaysEvents.length === 0) lines.push('- (nothing captured today)')

  lines.push(`\nOverdue actions (${g.overdue.length}):`)
  g.overdue.forEach((a) => lines.push(`- ${a.description} (due ${a.due?.slice(0, 10)})`))

  lines.push(`\nActions due in the next 3 days (${g.dueSoon.length}):`)
  g.dueSoon.forEach((a) => lines.push(`- ${a.description} (due ${a.due?.slice(0, 10)})`))

  lines.push(`\nMeetings in the next 2 days (${g.meetings.length}):`)
  g.meetings.forEach((m) =>
    lines.push(`- ${m.summary || '(untitled)'} at ${m.starts_at.slice(0, 16).replace('T', ' ')}${m.hasContext ? ' [context note attached]' : ''}`)
  )

  if (g.failedCount > 0) lines.push(`\n${g.failedCount} capture(s) failed to process today and need re-capturing.`)

  lines.push('\nWrite the morning brief.')
  return lines.join('\n')
}

/** Runs the nightly synthesiser and stores tomorrow's brief. */
export async function runSynthesiser(userId: string): Promise<{ body: string }> {
  const runId = await startRun(userId, 'synthesiser')
  const started = Date.now()
  try {
    const gathered = await gather(userId)
    const msg = await agentAnthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPrompt(gathered) }],
    })
    const body = textOf(msg)

    // The brief is read tomorrow morning, so key it to tomorrow's date.
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
    await saveOutput(userId, 'tomorrow_brief', tomorrow, {
      title: `Brief for ${tomorrow}`,
      body,
      data: {
        overdue: gathered.overdue.length,
        dueSoon: gathered.dueSoon.length,
        meetings: gathered.meetings.length,
        capturedToday: gathered.todaysEvents.length,
        failed: gathered.failedCount,
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
