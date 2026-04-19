import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { writeAuditLog } from '@/lib/audit/log'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_labels(*),
        event_entities(*, entity:entities(*)),
        extraction_results(*)
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    // Fetch current state for audit diff
    const { data: before, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !before) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const body = await request.json()

    // Only allow specific fields to be updated
    const updates: Record<string, unknown> = {}
    if ('edited_content' in body) updates.edited_content = body.edited_content
    if ('photo_caption_edited' in body) updates.photo_caption_edited = body.photo_caption_edited
    if ('is_deleted' in body) {
      updates.is_deleted = body.is_deleted
      updates.deleted_at = body.is_deleted ? new Date().toISOString() : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log with before/after diff
    writeAuditLog({
      userId: user.id,
      action: body.is_deleted ? 'event.soft_delete' : 'event.update',
      tableName: 'events',
      recordId: params.id,
      beforeData: before,
      afterData: data,
    })

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
