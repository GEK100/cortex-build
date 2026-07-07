import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { writeAuditLog } from '@/lib/audit/log'
import type { DecisionStatus } from '@/lib/db/types'

const VALID_STATUSES: DecisionStatus[] = ['recorded', 'implemented', 'superseded', 'reversed']

/**
 * Advance a decision through its lifecycle, or attach a rationale. The
 * statement itself is derived from the immutable source event and is not
 * editable here — only the lifecycle state and the rationale the PM adds.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const body = await request.json()
    const update: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 })
      }
      update.status = body.status
    }
    if (body.rationale !== undefined) update.rationale = body.rationale
    if (body.superseded_by !== undefined) update.superseded_by = body.superseded_by

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('decisions')
      .select('*')
      .eq('id', params.id)
      .eq('is_deleted', false)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: updated, error } = await supabase
      .from('decisions')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json({ error: error?.message || 'Update failed' }, { status: 500 })
    }

    writeAuditLog({
      userId: user.id,
      action: 'decision.update',
      tableName: 'decisions',
      recordId: params.id,
      beforeData: existing,
      afterData: updated,
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
