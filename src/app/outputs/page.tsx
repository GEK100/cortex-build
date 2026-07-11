import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ALLOWED_EMAIL } from '@/lib/config'

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
  if (!user || user.email !== ALLOWED_EMAIL) redirect('/login')

  const { data: review } = await supabase
    .from('agent_outputs')
    .select('title, body, created_at')
    .eq('kind', 'weekly_review')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-4">
      <h2 className="text-lg font-medium tracking-tight">Outputs</h2>

      {review && (
        <section>
          <h3 className="mb-2 text-sm font-medium">{review.title || 'Weekly review'}</h3>
          <div className="rounded-lg border border-border bg-card p-3 text-sm leading-relaxed whitespace-pre-wrap">
            {review.body}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Generated {new Date(review.created_at).toLocaleString('en-GB')}
          </p>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium">Generate a document</h3>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {OUTPUTS.map((o) => (
            <li key={o.kind} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div>
                <div className="text-sm">{o.label}</div>
                <div className="text-[11px] text-muted-foreground">{o.note}</div>
              </div>
              <a
                href={`/api/outputs/${o.kind}`}
                className="shrink-0 rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Every output is a starting point — review and edit before you file it.
        </p>
      </section>
    </main>
  )
}
