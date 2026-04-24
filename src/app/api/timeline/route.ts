import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'

/**
 * Timeline feed: events flagged `timeline_worthy` by extraction.
 *
 * Query params (all optional):
 *   min_significance — default 3 (per AD: timeline defaults to significance >=3)
 *   from, to         — ISO timestamps bounding captured_at
 *   limit, offset    — pagination (limit capped at 200)
 *
 * Label filtering is done client-side: filtering event_labels server-side with
 * an inner join would drop non-matching label rows from the response, which
 * breaks rendering badges for the full label set.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const { searchParams } = new URL(request.url)
    const minSignificance = Math.max(
      1,
      Math.min(5, parseInt(searchParams.get('min_significance') || '3', 10))
    )
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '100', 10),
      200
    )
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    let query = supabase
      .from('events')
      .select(
        `id, event_type, captured_at, raw_content, edited_content,
         photo_caption_raw, photo_caption_edited, extraction_status,
         event_labels(id, label, confidence),
         extraction_results!inner(
           significance, sentiment, timeline_worthy, timeline_headline
         )`
      )
      .eq('is_deleted', false)
      .eq('extraction_results.timeline_worthy', true)
      .gte('extraction_results.significance', minSignificance)
      .order('captured_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (from) query = query.gte('captured_at', from)
    if (to) query = query.lte('captured_at', to)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
