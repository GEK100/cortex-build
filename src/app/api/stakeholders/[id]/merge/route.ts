import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { writeAuditLog } from '@/lib/audit/log'

/**
 * Merge source entity (params.id) into target entity (body.target_id).
 *
 * Steps:
 *   1. Verify both exist, same user, same entity_type.
 *   2. Re-link every event_entities row from source -> target, handling the
 *      (event_id, entity_id, role) unique constraint via upsert with ignore.
 *   3. Union aliases: target.aliases gets source.canonical_name + source.aliases.
 *   4. Delete source entity (junctions were already moved; any remaining
 *      would be deleted by ON DELETE CASCADE anyway).
 *   5. Audit log the merge.
 *
 * The service-role admin client is used for the junction re-link so we can
 * bypass the unique-constraint upsert nuances on RLS-scoped writes. The
 * ownership check above means this is still single-user safe.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const body = await request.json()
    const targetId: string | undefined = body?.target_id
    const sourceId = params.id

    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json({ error: 'target_id required' }, { status: 400 })
    }
    if (targetId === sourceId) {
      return NextResponse.json(
        { error: 'Cannot merge an entity into itself' },
        { status: 400 }
      )
    }

    const { data: entities, error: fetchErr } = await supabase
      .from('entities')
      .select('*')
      .in('id', [sourceId, targetId])

    if (fetchErr || !entities || entities.length !== 2) {
      return NextResponse.json(
        { error: 'One or both entities not found' },
        { status: 404 }
      )
    }

    const source = entities.find((e) => e.id === sourceId)!
    const target = entities.find((e) => e.id === targetId)!

    if (source.entity_type !== target.entity_type) {
      return NextResponse.json(
        { error: 'Entities must be of the same type to merge' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Re-link junctions. Fetch source junctions, upsert onto target, delete
    // originals. Upsert handles (event_id, target_id, role) collisions.
    const { data: sourceJunctions, error: jErr } = await admin
      .from('event_entities')
      .select('id, event_id, role, context')
      .eq('entity_id', sourceId)

    if (jErr) {
      return NextResponse.json({ error: jErr.message }, { status: 500 })
    }

    if (sourceJunctions && sourceJunctions.length > 0) {
      const upserts = sourceJunctions.map((j) => ({
        event_id: j.event_id,
        entity_id: targetId,
        role: j.role,
        context: j.context,
      }))

      const { error: upsertErr } = await admin
        .from('event_entities')
        .upsert(upserts, { onConflict: 'event_id,entity_id,role', ignoreDuplicates: true })

      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 })
      }
    }

    // Union aliases
    const aliasSet = new Set<string>([
      ...(target.aliases || []),
      ...(source.aliases || []),
      source.canonical_name,
    ])
    aliasSet.delete(target.canonical_name)

    const { error: aliasErr } = await admin
      .from('entities')
      .update({ aliases: Array.from(aliasSet) })
      .eq('id', targetId)

    if (aliasErr) {
      return NextResponse.json({ error: aliasErr.message }, { status: 500 })
    }

    // Delete source. ON DELETE CASCADE clears any residual junctions.
    const { error: deleteErr } = await admin
      .from('entities')
      .delete()
      .eq('id', sourceId)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    writeAuditLog({
      userId: user.id,
      action: 'entity.merge',
      tableName: 'entities',
      recordId: targetId,
      beforeData: { source, target },
      afterData: {
        merged_source_id: sourceId,
        into_target_id: targetId,
        new_aliases: Array.from(aliasSet),
      },
    })

    return NextResponse.json({ ok: true, target_id: targetId })
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
