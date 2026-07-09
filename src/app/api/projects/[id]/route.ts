import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { writeAuditLog } from '@/lib/audit/log'

/**
 * Rename, recolour, or archive/restore a project. No delete — projects archive
 * (status = 'archived') so any events filed under them keep their filing.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const { data: before, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !before) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if ('name' in body) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) return NextResponse.json({ error: 'Project name cannot be empty' }, { status: 400 })
      updates.name = name
    }
    if ('colour' in body) {
      updates.colour = typeof body.colour === 'string' && body.colour.trim() ? body.colour.trim() : null
    }
    if ('status' in body) {
      if (!['active', 'archived'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updates.status = body.status
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      const status = error.code === '23505' ? 409 : 500
      const message = status === 409 ? 'A project with that name already exists' : error.message
      return NextResponse.json({ error: message }, { status })
    }

    writeAuditLog({
      userId: user.id,
      action: 'project.update',
      tableName: 'projects',
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
