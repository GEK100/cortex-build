import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ALLOWED_EMAIL, LABEL_COLOURS } from '@/lib/config'
import { getDashboardData } from '@/lib/dashboard/build'
import { UpcomingMeetings } from '@/components/calendar/upcoming-meetings'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function Stat({
  label,
  value,
  tone,
  href,
}: {
  label: string
  value: number
  tone?: 'alert'
  href?: string
}) {
  const inner = (
    <>
      <div className={cn('text-xl font-semibold tabular-nums', tone === 'alert' && value > 0 && 'text-destructive')}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </>
  )
  const className = 'block rounded-md border border-border px-3 py-2'
  return href ? (
    <Link href={href} className={cn(className, 'hover:bg-muted/40')}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.email !== ALLOWED_EMAIL) redirect('/login')

  const d = await getDashboardData(supabase, user.id)

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-4">
      {/* Morning brief */}
      <section>
        <h2 className="mb-2 text-lg font-medium tracking-tight">Today</h2>
        {d.brief ? (
          <div className="rounded-lg border border-border bg-muted/10 p-3 text-sm leading-relaxed whitespace-pre-wrap">
            {d.brief.body}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No brief yet — the synthesiser writes one each night. Capture through the day and
            it will have something to work with.
          </p>
        )}
      </section>

      {/* Health strip */}
      <section>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat label="Open actions" value={d.health.actionsOpen} href="/actions" />
          <Stat label="Overdue" value={d.health.actionsOverdue} tone="alert" href="/actions" />
          <Stat label="Open RFIs" value={d.health.rfisOpen} href="/actions" />
          <Stat label="Risks" value={d.health.risksOpen} href="/timeline" />
          <Stat label="Snags" value={d.health.snagsOpen} href="/timeline" />
          <Stat label="Decisions" value={d.health.decisionsRecorded} href="/decisions" />
        </div>
      </section>

      {/* Things drifting */}
      {d.drift && (
        <section>
          <h3 className="mb-1 text-sm font-medium">Things drifting</h3>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm leading-relaxed whitespace-pre-wrap">
            {d.drift.body}
          </div>
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Stakeholder heatmap */}
        <section>
          <h3 className="mb-2 text-sm font-medium">Stakeholders</h3>
          {d.stakeholders.length === 0 ? (
            <p className="text-xs text-muted-foreground">No contact recorded yet.</p>
          ) : (
            <ul className="space-y-1">
              {d.stakeholders.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <Link href={`/stakeholders/${s.id}`} className="truncate hover:underline">
                    {s.name}
                  </Link>
                  <span
                    className={cn(
                      'shrink-0 text-[11px]',
                      s.daysSince !== null && s.daysSince > 14
                        ? 'text-amber-700'
                        : 'text-muted-foreground'
                    )}
                    title={s.lastContact ?? ''}
                  >
                    {s.daysSince === 0 ? 'today' : `${s.daysSince}d ago`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* What's coming */}
        <section>
          <h3 className="mb-2 text-sm font-medium">What&apos;s coming</h3>
          <UpcomingMeetings days={14} />
        </section>
      </div>

      {/* Workstream grid */}
      {d.workstreams.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Workstreams</h3>
          <div className="overflow-hidden rounded-lg border border-border text-sm">
            <table className="w-full">
              <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Trade package</th>
                  <th className="px-2 py-1.5 text-right font-medium">Events</th>
                  <th className="px-2 py-1.5 text-right font-medium">Risks</th>
                  <th className="px-2 py-1.5 text-right font-medium">Snags</th>
                  <th className="px-2 py-1.5 text-right font-medium">RFIs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.workstreams.map((w) => (
                  <tr key={w.trade}>
                    <td className="px-3 py-1.5">{w.trade}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{w.total}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{w.risks || ''}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{w.snags || ''}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{w.rfis || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recent timeline strip */}
      {d.timelineStrip.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Recent</h3>
          <ul className="space-y-1.5">
            {d.timelineStrip.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2 text-sm">
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {e.captured_at.slice(5, 10)}
                </span>
                <Link href={`/events/${e.id}`} className="truncate hover:underline">
                  {e.headline}
                </Link>
                {e.labels[0] && (
                  <span className={cn('shrink-0 rounded-sm border px-1 text-[9px]', LABEL_COLOURS[e.labels[0]])}>
                    {e.labels[0]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
