import { redirect } from 'next/navigation'
import { Download, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader, PageShell } from '@/components/layout/page-header'

export const dynamic = 'force-dynamic'

const OUTPUTS: { kind: string; label: string; note: string }[] = [
  { kind: 'site-diary', label: 'Weekly site diary', note: 'Markdown, day-grouped narrative' },
  { kind: 'rfi-register', label: 'RFI register', note: 'CSV — opens in Excel' },
  { kind: 'risk-register', label: 'Risk register', note: 'CSV — opens in Excel' },
  { kind: 'commitment-tracker', label: 'Commitment tracker', note: 'CSV — aged, planned-vs-actual' },
  { kind: 'decision-log', label: 'Decision log', note: 'Print-ready HTML — save as PDF for disclosure' },
  { kind: 'stakeholder-report', label: 'Stakeholder report', note: 'Markdown, per-person summary' },
]

export default async function OutputsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: review } = await supabase
    .from('agent_outputs')
    .select('title, body, created_at')
    .eq('kind', 'weekly_review')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <PageShell size="narrow">
      <PageHeader eyebrow="Documents & reports" title="Outputs" subtitle="Export claims-ready records — a starting point to review before you file." />

      {review && (
        <section className="mb-6 rounded-lg border border-border bg-card shadow-xs">
          <header className="border-b border-border px-4 py-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {review.title || 'Weekly review'}
            </h3>
          </header>
          <div className="whitespace-pre-wrap p-4 text-sm leading-relaxed text-foreground">
            {review.body}
          </div>
          <p className="border-t border-border px-4 py-2 font-mono text-[10px] text-muted-foreground">
            Generated {new Date(review.created_at).toLocaleString('en-GB')}
          </p>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card shadow-xs">
        <header className="border-b border-border px-4 py-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Generate a document
          </h3>
        </header>
        <ul className="divide-y divide-border">
          {OUTPUTS.map((o) => (
            <li key={o.kind} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{o.label}</div>
                  <div className="text-[11px] text-muted-foreground">{o.note}</div>
                </div>
              </div>
              <a
                href={`/api/outputs/${o.kind}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-secondary px-3 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-secondary/70"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  )
}
