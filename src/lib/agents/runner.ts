import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AgentKind, AgentOutputKind } from '@/lib/db/types'

export const agentAnthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Records the start of an agent invocation in agent_runs and returns the run id.
 * The four agents (synthesiser, gap-finder, meeting-prep, weekly-reviewer) all
 * log through here so there is one observability spine.
 */
export async function startRun(userId: string, agent: AgentKind): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('agent_runs')
    .insert({ user_id: userId, agent, status: 'running' })
    .select('id')
    .single()
  return data?.id as string
}

export async function finishRun(
  runId: string | undefined,
  fields: {
    status: 'complete' | 'failed'
    model?: string
    tokensUsed?: number
    latencyMs?: number
    error?: string
  }
): Promise<void> {
  if (!runId) return
  const admin = createAdminClient()
  await admin
    .from('agent_runs')
    .update({
      status: fields.status,
      model_used: fields.model ?? null,
      tokens_used: fields.tokensUsed ?? null,
      latency_ms: fields.latencyMs ?? null,
      error: fields.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', runId)
}

/**
 * Upserts a durable narrative output (tomorrow-brief, gap report, meeting-prep,
 * weekly review) keyed by (user, kind, ref_key) so re-runs replace rather than
 * duplicate.
 */
export async function saveOutput(
  userId: string,
  kind: AgentOutputKind,
  refKey: string,
  fields: {
    title?: string
    body: string
    data?: Record<string, unknown>
    runId?: string
    refId?: string | null
  }
): Promise<void> {
  const admin = createAdminClient()
  await admin.from('agent_outputs').upsert(
    {
      user_id: userId,
      kind,
      ref_key: refKey,
      ref_id: fields.refId ?? null,
      title: fields.title ?? null,
      body: fields.body,
      data: fields.data ?? {},
      run_id: fields.runId ?? null,
    },
    { onConflict: 'user_id,kind,ref_key' }
  )
}

/** Extracts the concatenated text from a non-streaming Anthropic response. */
export function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

export function tokensOf(msg: Anthropic.Message): number {
  return (msg.usage?.input_tokens ?? 0) + (msg.usage?.output_tokens ?? 0)
}
