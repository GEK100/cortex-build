import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { writeAuditLog } from '@/lib/audit/log'

/**
 * Projects: freeform spaces for splitting captures. GET lists active projects
 * (the switcher); pass ?all=1 to include archived (the management view).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const includeArchived = new URL(request.url).searchParams.get('all') === '1'

    let query = supabase
      .from('projects')
      .select('*')
      .order('name', { ascending: true })

    if (!includeArchived) query = query.eq('status', 'active')

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }
    const colour = typeof body.colour === 'string' && body.colour.trim() ? body.colour.trim() : null

    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name, colour })
      .select()
      .single()

    if (error) {
      // Unique violation on (user_id, name) → friendly 409.
      const status = error.code === '23505' ? 409 : 500
      const message = status === 409 ? 'A project with that name already exists' : error.message
      return NextResponse.json({ error: message }, { status })
    }

    writeAuditLog({
      userId: user.id,
      action: 'project.create',
      tableName: 'projects',
      recordId: data.id,
      afterData: data,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
