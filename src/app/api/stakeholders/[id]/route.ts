import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import type { Sentiment } from '@/lib/db/types'

/**
 * Stakeholder detail: entity row plus a slice of recent events mentioning
 * this entity, plus a sentiment distribution across those events.
 *
 * The sentiment distribution is a cheap stand-in for the "relationship
 * temperature" Sonnet synthesis described in the build prompt. A proper
 * tone-shift read belongs in an agent pass, not a sync request.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  void _req
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const { data: entity, error: entityErr } = await supabase
      .from('entities')
      .select('*')
      .eq('id', params.id)
      .single()

    if (entityErr || !entity) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    type JoinedEvent = {
      id: string
      event_type: string
      captured_at: string
      raw_content: string | null
      edited_content: string | null
      photo_caption_raw: string | null
      photo_caption_edited: string | null
      extraction_status: string
      is_deleted: boolean
      event_labels: { id: string; label: string; confidence: number }[]
      extraction_results: {
        significance: number | null
        sentiment: Sentiment | null
        timeline_worthy: boolean
        timeline_headline: string | null
      }[]
    }
    type Junction = {
      role: string | null
      context: string | null
      events: JoinedEvent
    }

    const { data: junctions, error: eventsErr } = await supabase
      .from('event_entities')
      .select(
        `role, context,
         events!inner(
           id, event_type, captured_at, raw_content, edited_content,
           photo_caption_raw, photo_caption_edited, extraction_status, is_deleted,
           event_labels(id, label, confidence),
           extraction_results(significance, sentiment, timeline_worthy, timeline_headline)
         )`
      )
      .eq('entity_id', params.id)
      .eq('events.is_deleted', false)
      .order('captured_at', { foreignTable: 'events', ascending: false })
      .limit(50)
      .returns<Junction[]>()

    if (eventsErr) {
      return NextResponse.json({ error: eventsErr.message }, { status: 500 })
    }

    const events = (junctions ?? []).map((j) => ({
      ...j.events,
      junction_role: j.role,
      junction_context: j.context,
    }))

    // Sentiment distribution across all returned events
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0, mixed: 0 }
    for (const ev of events) {
      const s = ev.extraction_results?.[0]?.sentiment
      if (s && s in sentimentCounts) sentimentCounts[s]++
    }

    const lastContactAt = events[0]?.captured_at || null

    return NextResponse.json({
      entity,
      events,
      stats: {
        event_count: events.length,
        last_contact_at: lastContactAt,
        sentiment: sentimentCounts,
      },
    })
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
