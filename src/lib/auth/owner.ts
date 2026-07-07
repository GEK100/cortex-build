import { createAdminClient } from '@/lib/supabase/admin'
import { ALLOWED_EMAIL } from '@/lib/config'

let cachedOwnerId: string | null = null

/**
 * Resolves the single authorised user's id (build prompt §3.1 — one user).
 * Used by surfaces that have no session cookie of their own: the email intake
 * webhook and the scheduled agents. Cached for the lifetime of the server
 * instance since the owner never changes.
 */
export async function resolveOwnerUserId(): Promise<string> {
  if (cachedOwnerId) return cachedOwnerId

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw new Error(`Failed to list users: ${error.message}`)

  const owner = data.users.find((u) => u.email === ALLOWED_EMAIL)
  if (!owner) throw new Error(`Owner user (${ALLOWED_EMAIL}) not found`)

  cachedOwnerId = owner.id
  return cachedOwnerId
}
