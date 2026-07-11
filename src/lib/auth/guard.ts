import { type SupabaseClient } from '@supabase/supabase-js'

/**
 * Authentication guard. Every API route and server action must call this.
 * Returns the authenticated user or throws a Response (401). Data is isolated
 * per account by RLS (`auth.uid() = user_id` on every table), so any signed-in
 * user only ever sees their own rows — the app is multi-tenant.
 */
export async function assertAuthorisedUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Response('Unauthorised', { status: 401 })
  }

  return user
}
