import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Auth callback for every flow that returns a PKCE code — magic link, Google
 * OAuth, email confirmation, and password recovery. Constructs the
 * success-redirect response first, then binds the Supabase client's setAll
 * hook so session cookies land directly on that response. Relying on
 * next/headers cookies() auto-propagation into a hand-built
 * NextResponse.redirect() is flaky on Vercel with @supabase/ssr — this pattern
 * mirrors Supabase's App Router docs and is the robust path.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Where to land after a successful exchange (e.g. /reset-password for recovery).
  const next = searchParams.get('next') || '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const cookieStore = await cookies()
  const successResponse = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  return successResponse
}
