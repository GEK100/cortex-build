import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Minimal Google Calendar client. Google Calendar IS the calendar (build
 * prompt §3.5) — Cortex reads it and enriches it, it never reimplements a
 * calendar UI. Tokens live in `oauth_tokens` and are refreshed on demand.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
]

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  scope?: string
  token_type?: string
  expires_in?: number
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token on reconnect
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`)
  return res.json()
}

export async function persistTokens(
  userId: string,
  tokens: GoogleTokenResponse
): Promise<void> {
  const admin = createAdminClient()
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  // Preserve an existing refresh_token if Google omits it on a re-grant.
  const update: Record<string, unknown> = {
    user_id: userId,
    provider: 'google',
    access_token: tokens.access_token,
    scope: tokens.scope ?? null,
    token_type: tokens.token_type ?? null,
    expires_at: expiresAt,
  }
  if (tokens.refresh_token) update.refresh_token = tokens.refresh_token

  await admin.from('oauth_tokens').upsert(update, { onConflict: 'user_id,provider' })
}

/**
 * Returns a valid access token, refreshing via the stored refresh_token when
 * the cached one is within 60s of expiry. Throws if the user has not connected.
 */
export async function getAccessToken(userId: string): Promise<string> {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle()

  if (!row) throw new Error('Google Calendar not connected')

  const expiresSoon =
    !row.expires_at || new Date(row.expires_at).getTime() - Date.now() < 60_000

  if (!expiresSoon) return row.access_token as string
  if (!row.refresh_token) return row.access_token as string

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: row.refresh_token as string,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`)

  const refreshed: GoogleTokenResponse = await res.json()
  await persistTokens(userId, {
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? (row.refresh_token as string),
  })
  return refreshed.access_token
}

export interface GoogleCalendarEvent {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: { email?: string; displayName?: string; responseStatus?: string }[]
}

/**
 * Lists events across the user's calendars within a window. Defaults to the
 * primary calendar; the Cortex-Ops calendar id can be passed to scope tighter.
 */
export async function listEvents(
  userId: string,
  opts: { timeMin: string; timeMax: string; calendarId?: string }
): Promise<GoogleCalendarEvent[]> {
  const token = await getAccessToken(userId)
  const calendarId = encodeURIComponent(opts.calendarId ?? 'primary')
  const params = new URLSearchParams({
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  const res = await fetch(
    `${CALENDAR_API}/calendars/${calendarId}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Google Calendar list failed: ${await res.text()}`)

  const data = await res.json()
  return (data.items ?? []) as GoogleCalendarEvent[]
}
