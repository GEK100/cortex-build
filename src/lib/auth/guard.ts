import { type SupabaseClient } from '@supabase/supabase-js'
import { ALLOWED_EMAIL } from '@/lib/config'

/**
 * Hard single-user guard. Every API route and server action must call this.
 * Returns the authenticated user or throws a Response (401/403).
 */
export async function assertAuthorisedUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Response('Unauthorised', { status: 401 })
  }

  if (user.email !== ALLOWED_EMAIL) {
    throw new Response('Forbidden: this application is restricted', {
      status: 403,
    })
  }

  return user
}
