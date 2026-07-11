import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarClock, Mail, Bell, Database, UserCircle } from 'lucide-react'
import { CalendarConnect } from '@/components/settings/calendar-connect'
import { NotificationsToggle } from '@/components/settings/notifications-toggle'
import { DataExport } from '@/components/settings/data-export'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { PageHeader, PageShell } from '@/components/layout/page-header'

function SettingCard({
  icon: Icon,
  title,
  children,
  control,
}: {
  icon: typeof Mail
  title: string
  children: React.ReactNode
  control?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{children}</p>
      {control && <div className="mt-3">{control}</div>}
    </div>
  )
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: token } = await supabase
    .from('oauth_tokens')
    .select('provider, scope, updated_at')
    .eq('provider', 'google')
    .maybeSingle()

  return (
    <PageShell size="narrow">
      <PageHeader eyebrow="Workspace" title="Settings" subtitle="Connections, notifications, and your data." />

      <section className="space-y-4">
        <SettingCard icon={UserCircle} title="Account" control={<SignOutButton />}>
          Signed in as <span className="font-medium text-foreground">{user.email}</span>.
        </SettingCard>

        <SettingCard icon={CalendarClock} title="Google Calendar" control={<CalendarConnect connected={!!token} />}>
          Cortex reads your calendar to surface what&apos;s coming and to prepare you before
          meetings. It never replaces your calendar.
        </SettingCard>

        <SettingCard icon={Mail} title="Email intake">
          Forward or send mail to your dedicated intake address and each message becomes one
          event. Configure your inbound-parse provider to POST to{' '}
          <code className="rounded bg-secondary px-1 font-mono text-[11px]">/api/ingest/email</code>{' '}
          with the shared secret header.
        </SettingCard>

        <SettingCard icon={Bell} title="Notifications" control={<NotificationsToggle />}>
          Meeting-prep briefs and overdue-action alerts arrive as push notifications on this
          device.
        </SettingCard>

        <SettingCard icon={Database} title="Your data" control={<DataExport />}>
          Export everything Cortex holds as a single JSON file. You can leave with your data at
          any time.
        </SettingCard>
      </section>
    </PageShell>
  )
}
