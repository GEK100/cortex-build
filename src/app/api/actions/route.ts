import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'

/**
 * Actions list. "Overdue" is derived client-side from status='open' + due_at < now();
 * it is never stored as a status value. Default view is open+overdue (status=open).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const { searchParams } = new URL(request.url)
    const statuses = searchParams.getAll('status')
    const sourceKinds = searchParams.getAll('source_kind')
    const ownerId = searchParams.get('owner_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500)

    let query = supabase
      .from('actions')
      .select(
        `id, description, source_kind, status, raised_at, due_at, closed_at, evidence,
         source_event_id,
         owner:owner_entity_id(id, canonical_name, entity_type),
         raised_by:raised_by_entity_id(id, canonical_name, entity_type)`
      )
      .eq('is_deleted', false)
      .limit(limit)

    if (statuses.length > 0) query = query.in('status', statuses)
    if (sourceKinds.length > 0) query = query.in('source_kind', sourceKinds)
    if (ownerId) query = query.eq('owner_entity_id', ownerId)

    // Sort: open first (by due_at asc, nulls last), then closed/disputed by closed_at desc
    query = query.order('status', { ascending: true })
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('raised_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
