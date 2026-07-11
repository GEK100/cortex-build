import { type SupabaseClient } from '@supabase/supabase-js'
import { isAllowedEmail } from '@/lib/config'

/**
 * Authentication guard. Every API route and server action must call this.
 * Returns the authenticated user or throws a Response (401/403). Data is
 * isolated per account by RLS (`auth.uid() = user_id` on every table); the
 * allow-list additionally gates who may use the app while it is invite-only.
 */
export async function assertAuthorisedUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Response('Unauthorised', { status: 401 })
  }

  if (!isAllowedEmail(user.email)) {
    throw new Response('Forbidden: access is restricted', { status: 403 })
  }

  return user
}
