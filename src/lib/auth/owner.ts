import { createAdminClient } from '@/lib/supabase/admin'
import { ALLOWED_EMAIL } from '@/lib/config'

let cachedOwnerId: string | null = null

/**
 * Resolves the user id for background surfaces that carry no session cookie:
 * the email-intake webhook and the scheduled agents. Prefers the configured
 * `ALLOWED_EMAIL` owner (kept as the system/background-job owner), falling back
 * to the first registered user.
 *
 * NOTE: with multi-user access now enabled, background jobs still run for a
 * single owner. Fanning the scheduled agents and email intake out per-user is a
 * follow-up (they'd iterate all users / map intake addresses to accounts).
 */
export async function resolveOwnerUserId(): Promise<string> {
  if (cachedOwnerId) return cachedOwnerId

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw new Error(`Failed to list users: ${error.message}`)

  const owner = data.users.find((u) => u.email === ALLOWED_EMAIL) ?? data.users[0]
  if (!owner) throw new Error('No registered users found for background jobs')

  cachedOwnerId = owner.id
  return cachedOwnerId
}
