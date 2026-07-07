import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'

/** Decision log — chronological, filterable by lifecycle status. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const { searchParams } = new URL(request.url)
    const statuses = searchParams.getAll('status')

    let query = supabase
      .from('decisions')
      .select(
        `id, statement, rationale, status, decided_at, source_event_id, superseded_by,
         decided_by:decided_by_entity_id(id, canonical_name)`
      )
      .eq('is_deleted', false)
      .order('decided_at', { ascending: false })

    if (statuses.length > 0) query = query.in('status', statuses)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
