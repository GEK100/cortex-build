import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client that bypasses RLS.
 * Used exclusively for audit log writes and extraction pipeline.
 * Never expose to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
