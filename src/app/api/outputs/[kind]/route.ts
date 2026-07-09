import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * On-demand generated outputs (build prompt §generated outputs). Registers are
 * emitted as CSV (opens directly in Excel — no binary xlsx dependency); the
 * decision log and site diary as print-ready HTML (save-as-PDF for disclosure);
 * the stakeholder report as Markdown. Everything is derived from events and
 * editable by the PM before filing.
 */
const KINDS = [
  'site-diary',
  'risk-register',
  'rfi-register',
  'commitment-tracker',
  'decision-log',
  'stakeholder-report',
] as const
type Kind = (typeof KINDS)[number]

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function csv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function file(body: string, contentType: string, filename: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

const today = () => new Date().toISOString().slice(0, 10)

export async function GET(
  request: NextRequest,
  { params }: { params: { kind: string } }
) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const kind = params.kind as Kind
    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: 'Unknown output' }, { status: 404 })
    }

    switch (kind) {
      case 'risk-register':
        return await riskRegister(supabase)
      case 'rfi-register':
        return await actionsRegister(supabase, 'rfi', 'rfi-register')
      case 'commitment-tracker':
        return await actionsRegister(supabase, 'commitment', 'commitment-tracker')
      case 'decision-log':
        return await decisionLog(supabase)
      case 'site-diary':
        return await siteDiary(supabase)
      case 'stakeholder-report':
        return await stakeholderReport(supabase)
    }
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[outputs] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function riskRegister(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('events')
    .select('id, captured_at, extraction_results(timeline_headline, parsed_result, significance, sentiment), event_labels!inner(label)')
    .eq('is_deleted', false)
    .eq('event_labels.label', 'risk')
    .order('captured_at', { ascending: false })

  const rows: unknown[][] = [['Date raised', 'Risk', 'Significance', 'Sentiment', 'Event ID']]
  for (const e of (data ?? []) as unknown as {
    id: string
    captured_at: string
    extraction_results: { timeline_headline: string | null; parsed_result: { summary?: string } | null; significance: number | null; sentiment: string | null }[]
  }[]) {
    const x = e.extraction_results?.[0]
    rows.push([
      e.captured_at.slice(0, 10),
      x?.timeline_headline || x?.parsed_result?.summary || '',
      x?.significance ?? '',
      x?.sentiment ?? '',
      e.id,
    ])
  }
  return file(csv(rows), 'text/csv; charset=utf-8', `risk-register-${today()}.csv`)
}

async function actionsRegister(
  supabase: SupabaseClient,
  sourceKind: 'rfi' | 'commitment',
  name: string
) {
  const { data } = await supabase
    .from('actions')
    .select('description, status, raised_at, due_at, closed_at, evidence, owner:owner_entity_id(canonical_name), raised_by:raised_by_entity_id(canonical_name)')
    .eq('is_deleted', false)
    .eq('source_kind', sourceKind)
    .order('raised_at', { ascending: false })

  const header =
    sourceKind === 'commitment'
      ? ['Description', 'Owner', 'Raised by', 'Raised', 'Due', 'Closed', 'Days delta', 'Status', 'Evidence']
      : ['Description', 'Owner', 'Raised by', 'Raised', 'Due', 'Closed', 'Status', 'Evidence']

  const rows: unknown[][] = [header]
  for (const a of (data ?? []) as unknown as {
    description: string
    status: string
    raised_at: string
    due_at: string | null
    closed_at: string | null
    evidence: string | null
    owner: { canonical_name: string } | null
    raised_by: { canonical_name: string } | null
  }[]) {
    const base = [
      a.description,
      a.owner?.canonical_name ?? '',
      a.raised_by?.canonical_name ?? '',
      a.raised_at.slice(0, 10),
      a.due_at?.slice(0, 10) ?? '',
      a.closed_at?.slice(0, 10) ?? '',
    ]
    if (sourceKind === 'commitment') {
      // Planned-vs-actual: days between due and actual close (negative = early).
      let delta: number | '' = ''
      if (a.due_at && a.closed_at) {
        delta = Math.round((new Date(a.closed_at).getTime() - new Date(a.due_at).getTime()) / 86400_000)
      }
      rows.push([...base, delta, a.status, a.evidence ?? ''])
    } else {
      rows.push([...base, a.status, a.evidence ?? ''])
    }
  }
  return file(csv(rows), 'text/csv; charset=utf-8', `${name}-${today()}.csv`)
}

async function decisionLog(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('decisions')
    .select('statement, rationale, status, decided_at, source_event_id, decided_by:decided_by_entity_id(canonical_name)')
    .eq('is_deleted', false)
    .order('decided_at', { ascending: true })

  const rows = ((data ?? []) as unknown as {
    statement: string
    rationale: string | null
    status: string
    decided_at: string
    source_event_id: string
    decided_by: { canonical_name: string } | null
  }[])
    .map(
      (d) => `<tr>
        <td>${d.decided_at.slice(0, 10)}</td>
        <td>${esc(d.statement)}</td>
        <td>${d.decided_by ? esc(d.decided_by.canonical_name) : ''}</td>
        <td>${esc(d.rationale || '')}</td>
        <td>${d.status}</td>
      </tr>`
    )
    .join('\n')

  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<title>Decision Log — ${today()}</title>
<style>
  body { font-family: Georgia, serif; margin: 2rem; color: #1a1a1a; }
  h1 { font-size: 1.4rem; } .meta { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; }
  @media print { body { margin: 0.5cm; } }
</style></head><body>
<h1>Decision Log</h1>
<p class="meta">Generated ${today()} · disclosure-ready · print to PDF to file</p>
<table><thead><tr><th>Date</th><th>Decision</th><th>Decided by</th><th>Rationale</th><th>Status</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5">No decisions recorded.</td></tr>'}</tbody></table>
</body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

async function siteDiary(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('events')
    .select('captured_at, raw_content, edited_content, extraction_results(timeline_headline, parsed_result), event_labels!inner(label)')
    .eq('is_deleted', false)
    .eq('event_labels.label', 'site_diary')
    .order('captured_at', { ascending: true })

  const byDay = new Map<string, string[]>()
  for (const e of (data ?? []) as unknown as {
    captured_at: string
    raw_content: string | null
    edited_content: string | null
    extraction_results: { timeline_headline: string | null; parsed_result: { summary?: string } | null }[]
  }[]) {
    const day = e.captured_at.slice(0, 10)
    const line =
      e.extraction_results?.[0]?.parsed_result?.summary ||
      e.edited_content ||
      e.raw_content ||
      e.extraction_results?.[0]?.timeline_headline ||
      ''
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(line)
  }

  const md = [`# Site Diary`, `_Generated ${today()}_`, '']
  for (const [day, lines] of Array.from(byDay.entries())) {
    md.push(`## ${day}`, '')
    lines.forEach((l) => md.push(l, ''))
  }
  if (byDay.size === 0) md.push('No site-diary entries captured.')
  return file(md.join('\n'), 'text/markdown; charset=utf-8', `site-diary-${today()}.md`)
}

async function stakeholderReport(supabase: SupabaseClient) {
  const { data: entities } = await supabase
    .from('entities')
    .select('id, canonical_name, entity_type, event_entities(events(captured_at, is_deleted))')
    .in('entity_type', ['person', 'organisation'])
    .order('canonical_name')

  const { data: actions } = await supabase
    .from('actions')
    .select('description, status, owner_entity_id, due_at')
    .eq('is_deleted', false)
    .eq('status', 'open')

  const openByEntity = new Map<string, { description: string; due: string | null }[]>()
  for (const a of (actions ?? []) as { description: string; owner_entity_id: string | null; due_at: string | null }[]) {
    if (!a.owner_entity_id) continue
    if (!openByEntity.has(a.owner_entity_id)) openByEntity.set(a.owner_entity_id, [])
    openByEntity.get(a.owner_entity_id)!.push({ description: a.description, due: a.due_at })
  }

  const md = [`# Stakeholder Report`, `_Generated ${today()}_`, '']
  for (const e of (entities ?? []) as unknown as {
    id: string
    canonical_name: string
    entity_type: string
    event_entities: { events: { captured_at: string; is_deleted: boolean } | null }[]
  }[]) {
    const contacts = (e.event_entities ?? [])
      .map((j) => j.events)
      .filter((ev): ev is { captured_at: string; is_deleted: boolean } => !!ev && !ev.is_deleted)
      .map((ev) => ev.captured_at)
      .sort()
    if (contacts.length === 0) continue
    const last = contacts[contacts.length - 1].slice(0, 10)
    const open = openByEntity.get(e.id) ?? []
    md.push(`## ${e.canonical_name} (${e.entity_type})`)
    md.push(`Last contact: ${last} · ${contacts.length} interaction${contacts.length === 1 ? '' : 's'} · ${open.length} open item${open.length === 1 ? '' : 's'}`)
    open.forEach((o) => md.push(`- ${o.description}${o.due ? ` (due ${o.due.slice(0, 10)})` : ''}`))
    md.push('')
  }
  return file(md.join('\n'), 'text/markdown; charset=utf-8', `stakeholder-report-${today()}.md`)
}
