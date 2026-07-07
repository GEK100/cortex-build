import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ALLOWED_EMAIL } from '@/lib/config'
import { CalendarConnect } from '@/components/settings/calendar-connect'
import { NotificationsToggle } from '@/components/settings/notifications-toggle'
import { DataExport } from '@/components/settings/data-export'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email !== ALLOWED_EMAIL) redirect('/login')

  const { data: token } = await supabase
    .from('oauth_tokens')
    .select('provider, scope, updated_at')
    .eq('provider', 'google')
    .maybeSingle()

  return (
    <main className="mx-auto max-w-2xl px-4 py-4">
      <h2 className="mb-4 text-lg font-medium tracking-tight">Settings</h2>

      <section className="space-y-6">
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">Google Calendar</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Cortex reads your calendar to surface what&apos;s coming and to prepare
            you before meetings. It never replaces your calendar.
          </p>
          <div className="mt-3">
            <CalendarConnect connected={!!token} />
          </div>
        </div>

        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">Email intake</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Forward or send mail to your dedicated intake address and each message
            becomes one event. Configure your inbound-parse provider to POST to{' '}
            <code className="rounded bg-muted px-1">/api/ingest/email</code> with the
            shared secret header.
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">Notifications</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Meeting-prep briefs and overdue-action alerts arrive as push
            notifications on this device.
          </p>
          <div className="mt-3">
            <NotificationsToggle />
          </div>
        </div>

        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">Your data</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Export everything Cortex holds as a single JSON file. You can leave with
            your data at any time.
          </p>
          <div className="mt-3">
            <DataExport />
          </div>
        </div>
      </section>
    </main>
  )
}
