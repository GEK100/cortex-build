import { createAdminClient } from '@/lib/supabase/admin'
import { listEvents, type GoogleCalendarEvent } from './google'

function toIso(part?: { dateTime?: string; date?: string }): string | null {
  if (!part) return null
  if (part.dateTime) return new Date(part.dateTime).toISOString()
  if (part.date) return new Date(`${part.date}T00:00:00Z`).toISOString()
  return null
}

/**
 * Pulls upcoming Google Calendar events into the local `calendar_events`
 * cache. Idempotent: upserts on (user, provider, external_id), so re-running
 * refreshes summaries/times without duplicating. Cancelled events are marked,
 * not deleted, so a context note captured against one survives.
 */
export async function syncCalendar(
  userId: string,
  opts: { daysAhead?: number; daysBehind?: number; calendarId?: string } = {}
): Promise<{ synced: number }> {
  const daysAhead = opts.daysAhead ?? 21
  const daysBehind = opts.daysBehind ?? 1
  const now = Date.now()
  const timeMin = new Date(now - daysBehind * 86400_000).toISOString()
  const timeMax = new Date(now + daysAhead * 86400_000).toISOString()

  const events: GoogleCalendarEvent[] = await listEvents(userId, {
    timeMin,
    timeMax,
    calendarId: opts.calendarId,
  })

  const admin = createAdminClient()
  let synced = 0

  for (const ev of events) {
    const startsAt = toIso(ev.start)
    if (!startsAt) continue // skip events with no resolvable start

    const { error } = await admin.from('calendar_events').upsert(
      {
        user_id: userId,
        provider: 'google',
        external_id: ev.id,
        calendar_id: opts.calendarId ?? 'primary',
        summary: ev.summary ?? null,
        description: ev.description ?? null,
        location: ev.location ?? null,
        starts_at: startsAt,
        ends_at: toIso(ev.end),
        attendees: ev.attendees ?? [],
        html_link: ev.htmlLink ?? null,
        is_cancelled: ev.status === 'cancelled',
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,external_id' }
    )
    if (!error) synced++
  }

  return { synced }
}
