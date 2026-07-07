import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { assertCronRequest } from '@/lib/auth/cron'
import { resolveOwnerUserId } from '@/lib/auth/owner'

/**
 * Resolves the target user for an agent endpoint. Accepts either an authorised
 * browser session (manual "run now") or the cron secret (scheduled). Throws a
 * Response for the route's catch to re-return when neither is present.
 */
export async function resolveAgentUser(request: Request): Promise<string> {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)
    return user.id
  } catch (err) {
    if (err instanceof Response) {
      assertCronRequest(request) // throws 401/503 if not a valid cron call
      return resolveOwnerUserId()
    }
    throw err
  }
}
