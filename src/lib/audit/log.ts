import { createAdminClient } from '@/lib/supabase/admin'

interface AuditEntry {
  userId: string
  action: string
  tableName: string
  recordId: string
  beforeData?: Record<string, unknown> | null
  afterData: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Append-only audit log writer. Uses service-role client
 * to bypass RLS — the audit_log table has no insert policy
 * for authenticated users.
 *
 * Failures are logged but never block the calling operation.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('audit_log').insert({
      user_id: entry.userId,
      action: entry.action,
      table_name: entry.tableName,
      record_id: entry.recordId,
      before_data: entry.beforeData ?? null,
      after_data: entry.afterData,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
    })

    if (error) {
      console.error('[audit] Write failed:', error.message)
    }
  } catch (err) {
    console.error('[audit] Unexpected error:', err)
  }
}
