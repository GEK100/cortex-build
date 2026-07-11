import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/** Pages reachable without a session. */
const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password']

/**
 * Build a redirect response that preserves every cookie that
 * `updateSession` wrote onto `supabaseResponse`. Per Supabase SSR guidance:
 * NextResponse.redirect() creates a fresh response with no cookies, so any
 * session-refresh cookies written during the upstream getUser() call are
 * lost unless explicitly copied over.
 */
function redirectPreservingCookies(
  url: URL,
  supabaseResponse: NextResponse
): NextResponse {
  const redirect = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie)
  })
  return redirect
}

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)

  const { pathname } = request.nextUrl

  // Allow the auth callback and the public auth pages through.
  if (pathname.startsWith('/auth/callback') || PUBLIC_PATHS.includes(pathname)) {
    return supabaseResponse
  }

  // No session — redirect to login.
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return redirectPreservingCookies(url, supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|api).*)',
  ],
}
