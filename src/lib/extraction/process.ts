import { createAdminClient } from '@/lib/supabase/admin'
import { runExtraction } from './extract'
import { writeExtractionResults } from './persist'
import { writeAuditLog } from '@/lib/audit/log'
import type { ExtractionResult } from './ontology'

export interface ProcessResult {
  status: 'complete' | 'already_complete' | 'failed'
  parsed?: ExtractionResult
}

/**
 * Runs the full extraction pipeline for one event and persists the result.
 * This is the single server-side entry point shared by every capture surface —
 * the `/api/extract` route (browser fire-and-forget), the email webhook, the
 * chat capture path, and the offline flush all funnel through here so every
 * event is processed identically (build prompt §3.11: one pipeline, many
 * surfaces).
 *
 * Idempotent: an already-complete event is left untouched. On failure the
 * event is marked `failed` (surfaces in the tomorrow-brief) and the error is
 * audited — never silently dropped.
 */
export async function processExtraction(
  eventId: string,
  userId: string
): Promise<ProcessResult> {
  const admin = createAdminClient()

  const { data: event } = await admin
    .from('events')
    .select('extraction_status')
    .eq('id', eventId)
    .single()

  if (event?.extraction_status === 'complete') {
    return { status: 'already_complete' }
  }

  try {
    const { parsed, rawResponse, tokensUsed, latencyMs, model } =
      await runExtraction(eventId)

    await writeExtractionResults(
      eventId,
      userId,
      parsed,
      rawResponse,
      tokensUsed,
      latencyMs,
      model
    )

    return { status: 'complete', parsed }
  } catch (err) {
    console.error('[extract] Pipeline failed:', err)

    await admin
      .from('events')
      .update({ extraction_status: 'failed' })
      .eq('id', eventId)

    writeAuditLog({
      userId,
      action: 'extraction.failed',
      tableName: 'events',
      recordId: eventId,
      afterData: {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
    })

    return { status: 'failed' }
  }
}
