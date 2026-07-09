import type { SupabaseClient } from '@supabase/supabase-js'
import { writeAuditLog } from '@/lib/audit/log'
import { processExtraction } from '@/lib/extraction/process'
import type { Event, EventType } from '@/lib/db/types'

export interface CreateEventInput {
  event_type: EventType
  project_id?: string | null
  raw_content?: string | null
  audio_url?: string | null
  photo_url?: string | null
  audio_duration_seconds?: number | null
  photo_caption_raw?: string | null
  ocr_text?: string | null
  captured_at?: string | null
  source_device?: string | null
  offline_id?: string | null
  source_metadata?: Record<string, unknown> | null
}

export type ExtractionTrigger = 'http' | 'inline' | 'none'

export interface CreateEventOptions {
  /**
   * How to kick off extraction after insert:
   *  - 'http'   browser path: fire-and-forget self-call to /api/extract,
   *             forwarding the session cookie (keeps the request cheap).
   *  - 'inline' server-internal path (email webhook, chat capture, cron):
   *             await the pipeline so the caller can act on the result.
   *  - 'none'   caller handles extraction itself.
   */
  trigger?: ExtractionTrigger
  origin?: string
  cookie?: string
}

export interface CreateEventResult {
  event: Event
  deduped: boolean
}

/**
 * The single insertion path for every capture surface (voice, text, photo,
 * email, chat). Dedupes on offline_id, inserts the row under the caller's
 * RLS-scoped client, writes an audit entry, and triggers extraction.
 *
 * Keeping this in one place is what makes "one pipeline, many input surfaces"
 * (build prompt §3.11) literally true rather than aspirational — chat and email
 * cannot drift from the voice/text path because they call the same function.
 */
export async function createEvent(
  supabase: SupabaseClient,
  userId: string,
  input: CreateEventInput,
  options: CreateEventOptions = {}
): Promise<CreateEventResult> {
  const { trigger = 'inline', origin, cookie } = options

  // Deduplicate on offline_id (offline flush + retries).
  if (input.offline_id) {
    const { data: existing } = await supabase
      .from('events')
      .select('*')
      .eq('offline_id', input.offline_id)
      .maybeSingle()

    if (existing) {
      return { event: existing as Event, deduped: true }
    }
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      user_id: userId,
      event_type: input.event_type,
      project_id: input.project_id ?? null,
      raw_content: input.raw_content ?? null,
      audio_url: input.audio_url ?? null,
      photo_url: input.photo_url ?? null,
      audio_duration_seconds: input.audio_duration_seconds ?? null,
      photo_caption_raw: input.photo_caption_raw ?? null,
      ocr_text: input.ocr_text ?? null,
      captured_at: input.captured_at ?? new Date().toISOString(),
      source_device: input.source_device ?? null,
      offline_id: input.offline_id ?? null,
      source_metadata: input.source_metadata ?? {},
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to insert event')
  }

  const event = data as Event

  // Audit — fire and forget.
  writeAuditLog({
    userId,
    action: 'event.create',
    tableName: 'events',
    recordId: event.id,
    afterData: event as unknown as Record<string, unknown>,
  })

  if (trigger === 'http') {
    const base = resolveBaseUrl(origin)
    if (base) {
      fetch(`${base}/api/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie || '',
        },
        body: JSON.stringify({ event_id: event.id }),
      }).catch((err) => {
        console.error('[events] Failed to trigger extraction:', err)
      })
    }
  } else if (trigger === 'inline') {
    // Server-internal caller — run the pipeline in-process. Awaited so a
    // serverless function does not terminate before extraction completes.
    await processExtraction(event.id, userId)
  }

  return { event, deduped: false }
}

function resolveBaseUrl(origin?: string): string | null {
  if (!origin) return null
  if (origin.startsWith('http')) return origin
  const protocol = origin.startsWith('localhost') ? 'http' : 'https'
  return `${protocol}://${origin}`
}
