import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { ALLOWED_EMAIL } from '@/lib/config'

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)

  const { pathname } = request.nextUrl

  // Allow auth callback and login page through
  if (pathname.startsWith('/auth/callback') || pathname === '/login') {
    return supabaseResponse
  }

  // No session — redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Wrong user — sign out and redirect to login with error
  if (user.email !== ALLOWED_EMAIL) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'restricted')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|api).*)',
  ],
}
