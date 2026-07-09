import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { embedText } from '@/lib/search/embed'
import { applyProjectFilter } from '@/lib/projects/query'

/**
 * Hybrid search across the event graph (build prompt view 6). Keyword (ilike)
 * always runs; semantic (pgvector match_events) runs when embeddings are
 * available and merges in by event id. Results are grouped by type.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const searchParams = new URL(request.url).searchParams
    const q = (searchParams.get('q') || '').trim()
    if (!q) return NextResponse.json({ events: [], actions: [], entities: [], decisions: [] })
    // Project scope: null = all, 'none' = General, <uuid> = a project. Applies to
    // events, and to actions/decisions via their source event's project. Entities
    // are cross-project by nature (a person spans sites) so stay unscoped.
    const projectParam = searchParams.get('project_id')

    // Sanitise for the PostgREST `or` filter grammar (commas/parens are control chars).
    const safe = q.replace(/[(),]/g, ' ').trim()
    const like = `%${safe}%`

    // actions/decisions embed events!inner(project_id) only when scoping, so the
    // unscoped response shape is unchanged.
    const actionSelect: string = projectParam
      ? 'id, description, status, source_kind, due_at, source_event_id, events!inner(project_id)'
      : 'id, description, status, source_kind, due_at, source_event_id'
    const decisionSelect: string = projectParam
      ? 'id, statement, status, decided_at, source_event_id, events!inner(project_id)'
      : 'id, statement, status, decided_at, source_event_id'

    const [eventKeyword, actionsRes, entitiesRes, decisionsRes, embedding] = await Promise.all([
      applyProjectFilter(
        supabase
          .from('events')
          .select('id, captured_at, event_type, raw_content, edited_content, ocr_text, event_labels(label), extraction_results(timeline_headline, parsed_result)')
          .eq('is_deleted', false)
          .or(`raw_content.ilike.${like},edited_content.ilike.${like},ocr_text.ilike.${like}`)
          .order('captured_at', { ascending: false })
          .limit(30),
        projectParam
      ),
      applyProjectFilter(
        supabase
          .from('actions')
          .select(actionSelect)
          .eq('is_deleted', false)
          .ilike('description', like)
          .limit(20),
        projectParam,
        'events.project_id'
      ),
      supabase
        .from('entities')
        .select('id, canonical_name, entity_type')
        .ilike('canonical_name', like)
        .limit(20),
      applyProjectFilter(
        supabase
          .from('decisions')
          .select(decisionSelect)
          .eq('is_deleted', false)
          .ilike('statement', like)
          .limit(20),
        projectParam,
        'events.project_id'
      ),
      embedText(q),
    ])

    const eventMap = new Map<string, EventHit>()
    for (const e of (eventKeyword.data ?? []) as unknown as RawEvent[]) {
      eventMap.set(e.id, toEventHit(e))
    }

    // Semantic hits merged in (may surface events keyword missed).
    if (embedding) {
      const { data: matches } = await supabase.rpc('match_events', {
        query_embedding: embedding,
        match_count: 20,
        similarity_threshold: 0.2,
        filter_project: projectParam && projectParam !== 'none' ? projectParam : null,
        filter_general: projectParam === 'none',
      })
      const ids = ((matches ?? []) as { id: string; similarity: number }[]).filter(
        (m) => !eventMap.has(m.id)
      )
      if (ids.length > 0) {
        const simById = new Map(ids.map((m) => [m.id, m.similarity]))
        const { data: rows } = await supabase
          .from('events')
          .select('id, captured_at, event_type, raw_content, edited_content, ocr_text, event_labels(label), extraction_results(timeline_headline, parsed_result)')
          .in('id', ids.map((m) => m.id))
        for (const e of (rows ?? []) as unknown as RawEvent[]) {
          const hit = toEventHit(e)
          hit.similarity = simById.get(e.id) ?? null
          eventMap.set(e.id, hit)
        }
      }
    }

    const events = Array.from(eventMap.values()).sort((a, b) => {
      if (a.similarity !== null && b.similarity !== null) return b.similarity - a.similarity
      if (a.similarity !== null) return -1
      if (b.similarity !== null) return 1
      return b.captured_at.localeCompare(a.captured_at)
    })

    return NextResponse.json({
      events,
      actions: actionsRes.data ?? [],
      entities: entitiesRes.data ?? [],
      decisions: decisionsRes.data ?? [],
      semantic: !!embedding,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[search] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

interface RawEvent {
  id: string
  captured_at: string
  event_type: string
  raw_content: string | null
  edited_content: string | null
  ocr_text: string | null
  event_labels: { label: string }[]
  extraction_results: { timeline_headline: string | null; parsed_result: { summary?: string } | null }[]
}

interface EventHit {
  id: string
  captured_at: string
  event_type: string
  headline: string
  snippet: string
  labels: string[]
  similarity: number | null
}

function toEventHit(e: RawEvent): EventHit {
  const x = e.extraction_results?.[0]
  const snippet = (e.edited_content || e.raw_content || e.ocr_text || '').slice(0, 160)
  return {
    id: e.id,
    captured_at: e.captured_at,
    event_type: e.event_type,
    headline: x?.timeline_headline || x?.parsed_result?.summary || snippet || '(event)',
    snippet,
    labels: (e.event_labels ?? []).map((l) => l.label),
    similarity: null,
  }
}
