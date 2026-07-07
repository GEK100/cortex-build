import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { exchangeCode, persistTokens } from '@/lib/calendar/google'
import { writeAuditLog } from '@/lib/audit/log'

/**
 * Google OAuth redirect target. Verifies the state cookie, confirms the same
 * authorised session, exchanges the code, and stores the tokens (service role).
 */
export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const fail = (reason: string) =>
    NextResponse.redirect(`${base}/dashboard?calendar=error&reason=${reason}`)

  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const { searchParams } = request.nextUrl
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const cookieState = request.cookies.get('cortex_oauth_state')?.value

    if (!code) return fail('no_code')
    if (!state || state !== cookieState) return fail('bad_state')

    const redirectUri = `${base}/api/calendar/callback`
    const tokens = await exchangeCode(code, redirectUri)
    await persistTokens(user.id, tokens)

    writeAuditLog({
      userId: user.id,
      action: 'calendar.connect',
      tableName: 'oauth_tokens',
      recordId: user.id,
      afterData: { provider: 'google', scope: tokens.scope ?? null },
    })

    const res = NextResponse.redirect(`${base}/dashboard?calendar=connected`)
    res.cookies.delete('cortex_oauth_state')
    return res
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[calendar/callback] Error:', err)
    return fail('exception')
  }
}
