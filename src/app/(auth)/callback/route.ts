import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ALLOWED_EMAIL } from '@/lib/config'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Hard single-user check at the gate
      if (data.user.email !== ALLOWED_EMAIL) {
        await supabase.auth.signOut()
        return NextResponse.redirect(
          `${origin}/login?error=restricted`
        )
      }

      return NextResponse.redirect(origin)
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
