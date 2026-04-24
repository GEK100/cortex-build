import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { writeAuditLog } from '@/lib/audit/log'

/**
 * Action mutations. The request body carries an `action` discriminator that
 * maps to a narrow, intention-specific field set — this is safer than letting
 * the client PATCH arbitrary columns on a lifecycle-bearing row.
 *
 *   close:    status='closed', closed_at=now(), evidence (optional)
 *   dispute:  status='disputed', evidence (optional)
 *   cancel:   status='cancelled'
 *   reopen:   status='open', closed_at=null
 *   edit:     description and/or due_at (correction after a misfired extraction)
 */
type PatchOp = 'close' | 'dispute' | 'cancel' | 'reopen' | 'edit'

interface PatchBody {
  action: PatchOp
  evidence?: string
  description?: string
  due_at?: string | null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const body = (await request.json()) as PatchBody
    if (!body?.action) {
      return NextResponse.json({ error: 'action required' }, { status: 400 })
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('actions')
      .select('*')
      .eq('id', params.id)
      .eq('is_deleted', false)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const update: Record<string, unknown> = {}
    switch (body.action) {
      case 'close':
        update.status = 'closed'
        update.closed_at = new Date().toISOString()
        if (body.evidence !== undefined) update.evidence = body.evidence
        break
      case 'dispute':
        update.status = 'disputed'
        if (body.evidence !== undefined) update.evidence = body.evidence
        break
      case 'cancel':
        update.status = 'cancelled'
        break
      case 'reopen':
        update.status = 'open'
        update.closed_at = null
        break
      case 'edit':
        if (body.description !== undefined) {
          if (!body.description.trim()) {
            return NextResponse.json(
              { error: 'description cannot be empty' },
              { status: 400 }
            )
          }
          update.description = body.description.trim()
        }
        if (body.due_at !== undefined) update.due_at = body.due_at
        if (Object.keys(update).length === 0) {
          return NextResponse.json(
            { error: 'edit requires description or due_at' },
            { status: 400 }
          )
        }
        break
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const { data: updated, error: updateErr } = await supabase
      .from('actions')
      .update(update)
      .eq('id', params.id)
      .select()
      .single()

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message || 'Update failed' },
        { status: 500 }
      )
    }

    writeAuditLog({
      userId: user.id,
      action: `action.${body.action}`,
      tableName: 'actions',
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
