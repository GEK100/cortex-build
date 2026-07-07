import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { buildAuthUrl } from '@/lib/calendar/google'
import { v4 as uuid } from 'uuid'

/**
 * Starts the Google Calendar OAuth flow. Requires an authorised session; sets
 * a short-lived state cookie for CSRF protection and redirects to Google.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const redirectUri = `${base}/api/calendar/callback`
    const state = uuid()

    const res = NextResponse.redirect(buildAuthUrl(redirectUri, state))
    res.cookies.set('cortex_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })
    return res
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
