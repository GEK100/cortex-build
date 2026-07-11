import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowUpRight, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LABEL_COLOURS } from '@/lib/config'
import { getDashboardData } from '@/lib/dashboard/build'
import { ACTIVE_PROJECT_COOKIE, toFilterParam } from '@/lib/projects/util'
import { UpcomingMeetings } from '@/components/calendar/upcoming-meetings'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function Metric({
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
  const alert = tone === 'alert' && value > 0
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {href && (
          <ArrowUpRight className="h-3 w-3 text-muted-foreground/50 transition-colors group-hover:text-primary" />
        )}
      </div>
      <div
        className={cn(
          'mt-2.5 font-mono text-3xl font-semibold tabular-nums leading-none transition-all',
          alert ? 'text-destructive' : 'text-foreground group-hover:text-primary group-hover:text-glow'
        )}
      >
        {value}
      </div>
    </>
  )
  const className = cn(
    'group block rounded-lg border bg-card p-3.5 shadow-xs transition-all',
    alert ? 'border-destructive/40' : 'border-border',
    href && (alert
      ? 'hover:-translate-y-0.5 hover:border-destructive/60'
      : 'hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-glow')
  )
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  )
}

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg border border-border bg-card shadow-xs', className)}>
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const activeProject = cookies().get(ACTIVE_PROJECT_COOKIE)?.value ?? 'all'
  const d = await getDashboardData(supabase, toFilterParam(activeProject))
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="mx-auto max-w-6xl animate-rise space-y-6 px-4 py-6 md:px-6">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            Site Intelligence
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your live project picture.</p>
        </div>
        <span className="hidden font-mono text-xs uppercase tracking-wide text-muted-foreground sm:block">
          {today}
        </span>
      </div>

      {/* Mobile quick links (desktop uses the sidebar) */}
      <nav className="flex flex-wrap gap-2 md:hidden">
        {[
          { href: '/decisions', label: 'Decisions' },
          { href: '/outputs', label: 'Outputs' },
          { href: '/projects', label: 'Projects' },
          { href: '/events', label: 'All events' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs hover:text-foreground"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {/* Health strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Open actions" value={d.health.actionsOpen} href="/actions" />
        <Metric label="Overdue" value={d.health.actionsOverdue} tone="alert" href="/actions" />
        <Metric label="Open RFIs" value={d.health.rfisOpen} href="/actions" />
        <Metric label="Risks" value={d.health.risksOpen} href="/timeline" />
        <Metric label="Snags" value={d.health.snagsOpen} href="/timeline" />
        <Metric label="Decisions" value={d.health.decisionsRecorded} href="/decisions" />
      </div>

      {/* Today's brief */}
      <Panel title="Today's brief">
        {d.brief ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{d.brief.body}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No brief yet — the synthesiser writes one each night. Capture through the day and it
            will have something to work with.
          </p>
        )}
      </Panel>

      {/* Things drifting */}
      {d.drift && (
        <section className="rounded-lg border border-warning/40 bg-warning/5 shadow-xs">
          <header className="flex items-center gap-2 border-b border-warning/30 px-4 py-2.5">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-warning">
              Things drifting
            </h3>
          </header>
          <div className="whitespace-pre-wrap p-4 text-sm leading-relaxed text-foreground">
            {d.drift.body}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stakeholders */}
        <Panel title="Stakeholders">
          {d.stakeholders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contact recorded yet.</p>
          ) : (
            <ul className="-my-1 divide-y divide-border">
              {d.stakeholders.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                  <Link href={`/stakeholders/${s.id}`} className="truncate font-medium hover:text-primary">
                    {s.name}
                  </Link>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-[11px] tabular-nums',
                      s.daysSince !== null && s.daysSince > 14 ? 'text-warning' : 'text-muted-foreground'
                    )}
                    title={s.lastContact ?? ''}
                  >
                    {s.daysSince === 0 ? 'today' : `${s.daysSince}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* What's coming */}
        <Panel title="What's coming">
          <UpcomingMeetings days={14} />
        </Panel>
      </div>

      {/* Workstreams */}
      {d.workstreams.length > 0 && (
        <Panel title="Workstreams" className="overflow-hidden">
          <div className="-m-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">Trade package</th>
                  <th className="px-3 py-2 text-right font-semibold">Events</th>
                  <th className="px-3 py-2 text-right font-semibold">Risks</th>
                  <th className="px-3 py-2 text-right font-semibold">Snags</th>
                  <th className="px-4 py-2 text-right font-semibold">RFIs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.workstreams.map((w) => (
                  <tr key={w.trade} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-2 font-medium">{w.trade}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">{w.total}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{w.risks || <span className="text-muted-foreground/40">·</span>}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{w.snags || <span className="text-muted-foreground/40">·</span>}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{w.rfis || <span className="text-muted-foreground/40">·</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Recent */}
      {d.timelineStrip.length > 0 && (
        <Panel title="Recent" action={<Link href="/timeline" className="text-xs font-medium text-primary hover:underline">Timeline →</Link>}>
          <ul className="-my-1 divide-y divide-border">
            {d.timelineStrip.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 py-1.5 text-sm">
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {e.captured_at.slice(5, 10)}
                </span>
                <Link href={`/events/${e.id}`} className="flex-1 truncate hover:text-primary">
                  {e.headline}
                </Link>
                {e.labels[0] && (
                  <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide', LABEL_COLOURS[e.labels[0]])}>
                    {e.labels[0]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
