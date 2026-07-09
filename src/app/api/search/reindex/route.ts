import { NextResponse } from 'next/server'
import { resolveAgentUser } from '@/lib/agents/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedText } from '@/lib/search/embed'

export const maxDuration = 300

/**
 * Backfills embeddings for events that have none (first-time index, or after a
 * gap where OpenAI was unavailable). Callable by the owner or by cron. Bounded
 * per invocation so it never runs away; re-run until it reports 0 remaining.
 */
export async function POST(request: Request) {
  try {
    const userId = await resolveAgentUser(request)
    const admin = createAdminClient()

    const { data: pending } = await admin
      .from('events')
      .select('id, raw_content, edited_content, ocr_text, extraction_results(parsed_result, timeline_headline)')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .is('embedding', null)
      .limit(50)

    let indexed = 0
    for (const e of (pending ?? []) as unknown as {
      id: string
      raw_content: string | null
      edited_content: string | null
      ocr_text: string | null
      extraction_results: { parsed_result: { summary?: string } | null; timeline_headline: string | null }[]
    }[]) {
      const text = [
        e.extraction_results?.[0]?.parsed_result?.summary ?? '',
        e.extraction_results?.[0]?.timeline_headline ?? '',
        e.edited_content || e.raw_content || '',
        e.ocr_text || '',
      ]
        .filter(Boolean)
        .join('\n')
      const embedding = await embedText(text)
      if (embedding) {
        await admin.from('events').update({ embedding }).eq('id', e.id)
        indexed++
      }
    }

    return NextResponse.json({ indexed, remaining: (pending?.length ?? 0) - indexed })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[search/reindex] Error:', err)
    return NextResponse.json({ error: 'Reindex failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
