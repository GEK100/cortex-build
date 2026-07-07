import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatCitation } from '@/lib/db/types'

export interface RetrievalScope {
  /** Restrict to events linked to this entity (stakeholder-scoped chat). */
  entityId?: string
  /** Anchor on one event plus anything sharing its entities (timeline detail chat). */
  eventId?: string
  /** How many days back to window. Default 30 (build prompt: recent-context windowing). */
  days?: number
  /** Hard cap on events pulled into context. Default 120. */
  limit?: number
}

export interface RetrievalResult {
  /** Numbered, compact context block for the system prompt. */
  contextText: string
  /** Ordered citations, index = position (1-based) referenced as [E<n>] by the model. */
  citations: ChatCitation[]
  eventCount: number
  /** ISO date of the oldest event in the window (for the synthesis provenance banner). */
  earliest: string | null
}

interface RetrievedRow {
  id: string
  captured_at: string
  event_type: string
  raw_content: string | null
  edited_content: string | null
  photo_caption_edited: string | null
  photo_caption_raw: string | null
  event_labels: { label: string }[]
  extraction_results: {
    significance: number | null
    sentiment: string | null
    timeline_headline: string | null
    parsed_result: { summary?: string } | null
  }[]
  event_entities: { entity: { canonical_name: string; entity_type: string } | null }[]
}

function bodyText(r: RetrievedRow): string {
  const summary = r.extraction_results?.[0]?.parsed_result?.summary
  if (summary) return summary
  const raw =
    r.edited_content ||
    r.raw_content ||
    r.photo_caption_edited ||
    r.photo_caption_raw ||
    ''
  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw
}

function headline(r: RetrievedRow): string {
  return r.extraction_results?.[0]?.timeline_headline || bodyText(r).slice(0, 80)
}

/**
 * Assembles the retrieval context for a chat turn. Pulls recent events
 * (optionally scoped to an entity or anchored on one event), and returns a
 * numbered block the model cites as [E1], [E2]… plus the citation map that
 * lets the client turn those markers back into tap-to-open source links.
 *
 * This is deliberately keyword/recency retrieval, not semantic — embeddings
 * land in Week 5 (AD-013). Windowing keeps the token cost bounded.
 */
export async function retrieveContext(
  supabase: SupabaseClient,
  userId: string,
  scope: RetrievalScope = {}
): Promise<RetrievalResult> {
  const days = scope.days ?? 30
  const limit = Math.min(scope.limit ?? 120, 200)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const select = `
    id, captured_at, event_type, raw_content, edited_content,
    photo_caption_edited, photo_caption_raw,
    event_labels(label),
    extraction_results(significance, sentiment, timeline_headline, parsed_result),
    event_entities(entity:entities(canonical_name, entity_type))
  `

  // Resolve the set of event ids in scope first when entity/event-anchored,
  // so we can widen to sibling events sharing the anchor's entities.
  let eventIds: string[] | null = null

  if (scope.entityId) {
    const { data } = await supabase
      .from('event_entities')
      .select('event_id')
      .eq('entity_id', scope.entityId)
    eventIds = (data ?? []).map((r: { event_id: string }) => r.event_id)
  } else if (scope.eventId) {
    const { data: anchorEntities } = await supabase
      .from('event_entities')
      .select('entity_id')
      .eq('event_id', scope.eventId)
    const entityIds = (anchorEntities ?? []).map(
      (r: { entity_id: string }) => r.entity_id
    )
    const ids = new Set<string>([scope.eventId])
    if (entityIds.length > 0) {
      const { data: siblings } = await supabase
        .from('event_entities')
        .select('event_id')
        .in('entity_id', entityIds)
      for (const s of siblings ?? []) ids.add((s as { event_id: string }).event_id)
    }
    eventIds = Array.from(ids)
  }

  let query = supabase
    .from('events')
    .select(select)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('captured_at', since)
    .order('captured_at', { ascending: false })
    .limit(limit)

  if (eventIds) {
    if (eventIds.length === 0) {
      return { contextText: '(no captured events in scope)', citations: [], eventCount: 0, earliest: null }
    }
    query = query.in('id', eventIds)
  }

  const { data, error } = await query
  if (error || !data) {
    return { contextText: '(retrieval error)', citations: [], eventCount: 0, earliest: null }
  }

  const rows = data as unknown as RetrievedRow[]
  const citations: ChatCitation[] = []
  const lines: string[] = []

  rows.forEach((r, i) => {
    const n = i + 1
    const labels = r.event_labels?.map((l) => l.label).join(', ') || 'unlabelled'
    const entities =
      r.event_entities
        ?.map((e) => e.entity?.canonical_name)
        .filter(Boolean)
        .join(', ') || '—'
    const when = r.captured_at.slice(0, 16).replace('T', ' ')
    lines.push(
      `[E${n}] ${when} | ${labels} | ${bodyText(r)} | entities: ${entities}`
    )
    citations.push({
      event_id: r.id,
      captured_at: r.captured_at,
      headline: headline(r),
    })
  })

  const earliest = rows.length > 0 ? rows[rows.length - 1].captured_at : null

  return {
    contextText: lines.length > 0 ? lines.join('\n') : '(no captured events in scope)',
    citations,
    eventCount: rows.length,
    earliest,
  }
}
