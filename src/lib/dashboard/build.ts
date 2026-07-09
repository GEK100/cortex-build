import type { SupabaseClient } from '@supabase/supabase-js'
import { applyProjectFilter } from '@/lib/projects/query'

export interface DashboardData {
  health: {
    actionsOpen: number
    actionsOverdue: number
    rfisOpen: number
    risksOpen: number
    snagsOpen: number
    decisionsRecorded: number
  }
  stakeholders: { id: string; name: string; type: string; lastContact: string | null; daysSince: number | null }[]
  workstreams: { trade: string; total: number; risks: number; snags: number; rfis: number }[]
  timelineStrip: { id: string; headline: string; captured_at: string; labels: string[] }[]
  brief: { body: string; created_at: string; data: Record<string, unknown> } | null
  drift: { body: string; created_at: string; data: Record<string, unknown> } | null
}

type ContactJoin = { events: { captured_at: string; is_deleted: boolean } | null }[]

/**
 * Builds the one-screen dashboard payload from events (build prompt view 2).
 * Everything here is derived — the dashboard is never manually edited. Single-
 * user, low volume, so aggregation happens in JS rather than SQL views.
 */
export async function getDashboardData(
  supabase: SupabaseClient,
  projectParam: string | null = null
): Promise<DashboardData> {
  const nowIso = new Date().toISOString()

  // Health/timeline scope to the active project via each row's source event.
  // Stakeholders and trade packages stay global — an entity (a person, a trade)
  // is cross-project by nature, so scoping them to one site is misleading.
  // Typed as plain string so Supabase's select parser stays generic (the
  // conditional embed is not a literal it can resolve).
  const actionsSelect: string = projectParam
    ? 'status, source_kind, due_at, events!inner(project_id)'
    : 'status, source_kind, due_at'
  const decisionsSelect: string = projectParam ? 'id, events!inner(project_id)' : 'id'

  const [
    actionsRes,
    riskCountRes,
    snagCountRes,
    decisionsCountRes,
    stakeholdersRes,
    tradesRes,
    timelineRes,
    briefRes,
    driftRes,
  ] = await Promise.all([
    applyProjectFilter(
      supabase.from('actions').select(actionsSelect).eq('is_deleted', false),
      projectParam,
      'events.project_id'
    ),
    applyProjectFilter(
      supabase
        .from('event_labels')
        .select('event_id, events!inner(is_deleted)', { count: 'exact', head: true })
        .eq('label', 'risk')
        .eq('events.is_deleted', false),
      projectParam,
      'events.project_id'
    ),
    applyProjectFilter(
      supabase
        .from('event_labels')
        .select('event_id, events!inner(is_deleted)', { count: 'exact', head: true })
        .eq('label', 'snag')
        .eq('events.is_deleted', false),
      projectParam,
      'events.project_id'
    ),
    applyProjectFilter(
      supabase
        .from('decisions')
        .select(decisionsSelect, { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status', 'recorded'),
      projectParam,
      'events.project_id'
    ),
    supabase
      .from('entities')
      .select('id, canonical_name, entity_type, event_entities(events(captured_at, is_deleted))')
      .in('entity_type', ['person', 'organisation']),
    supabase
      .from('entities')
      .select('canonical_name, event_entities(events(is_deleted, event_labels(label)))')
      .eq('entity_type', 'trade_package'),
    applyProjectFilter(
      supabase
        .from('events')
        .select('id, captured_at, event_labels(label), extraction_results!inner(timeline_headline, timeline_worthy, significance)')
        .eq('is_deleted', false)
        .eq('extraction_results.timeline_worthy', true)
        .gte('extraction_results.significance', 3)
        .order('captured_at', { ascending: false })
        .limit(8),
      projectParam
    ),
    supabase
      .from('agent_outputs')
      .select('body, created_at, data')
      .eq('kind', 'tomorrow_brief')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('agent_outputs')
      .select('body, created_at, data')
      .eq('kind', 'gap_report')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Health strip
  let actionsOpen = 0
  let actionsOverdue = 0
  let rfisOpen = 0
  for (const a of actionsRes.data ?? []) {
    const row = a as unknown as { status: string; source_kind: string; due_at: string | null }
    if (row.status === 'open') {
      actionsOpen++
      if (row.due_at && row.due_at < nowIso) actionsOverdue++
      if (row.source_kind === 'rfi') rfisOpen++
    }
  }

  // Stakeholder heatmap — most recently contacted first, top 12.
  const stakeholders = (stakeholdersRes.data ?? [])
    .map((e) => {
      const row = e as unknown as {
        id: string
        canonical_name: string
        entity_type: string
        event_entities: ContactJoin
      }
      const contacts = (row.event_entities ?? [])
        .map((j) => j.events)
        .filter((ev): ev is { captured_at: string; is_deleted: boolean } => !!ev && !ev.is_deleted)
        .map((ev) => ev.captured_at)
        .sort()
      const last = contacts.length ? contacts[contacts.length - 1] : null
      const daysSince = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400_000) : null
      return { id: row.id, name: row.canonical_name, type: row.entity_type, lastContact: last, daysSince }
    })
    .filter((s) => s.lastContact !== null)
    .sort((a, b) => (b.lastContact! > a.lastContact! ? 1 : -1))
    .slice(0, 12)

  // Workstream grid — trade package × dimension counts.
  const workstreams = (tradesRes.data ?? [])
    .map((t) => {
      const row = t as unknown as {
        canonical_name: string
        event_entities: { events: { is_deleted: boolean; event_labels: { label: string }[] } | null }[]
      }
      let total = 0
      let risks = 0
      let snags = 0
      let rfis = 0
      for (const j of row.event_entities ?? []) {
        const ev = j.events
        if (!ev || ev.is_deleted) continue
        total++
        for (const l of ev.event_labels ?? []) {
          if (l.label === 'risk') risks++
          else if (l.label === 'snag') snags++
          else if (l.label === 'rfi') rfis++
        }
      }
      return { trade: row.canonical_name, total, risks, snags, rfis }
    })
    .filter((w) => w.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const timelineStrip = (timelineRes.data ?? []).map((e) => {
    const row = e as {
      id: string
      captured_at: string
      event_labels: { label: string }[]
      extraction_results: { timeline_headline: string | null }[]
    }
    return {
      id: row.id,
      captured_at: row.captured_at,
      headline: row.extraction_results?.[0]?.timeline_headline || '(event)',
      labels: (row.event_labels ?? []).map((l) => l.label),
    }
  })

  return {
    health: {
      actionsOpen,
      actionsOverdue,
      rfisOpen,
      risksOpen: riskCountRes.count ?? 0,
      snagsOpen: snagCountRes.count ?? 0,
      decisionsRecorded: decisionsCountRes.count ?? 0,
    },
    stakeholders,
    workstreams,
    timelineStrip,
    brief: briefRes.data
      ? { body: briefRes.data.body, created_at: briefRes.data.created_at, data: briefRes.data.data ?? {} }
      : null,
    drift: driftRes.data
      ? { body: driftRes.data.body, created_at: driftRes.data.created_at, data: driftRes.data.data ?? {} }
      : null,
  }
}
