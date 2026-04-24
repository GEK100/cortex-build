import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import type { EntityType } from '@/lib/db/types'

/**
 * Stakeholder list: all entities of type person or organisation, augmented
 * with event_count and last_contact_at aggregated from non-deleted events.
 *
 * Aggregation happens in JS rather than SQL — single-user low volume means
 * this stays well under any threshold where a view or RPC would be worth it.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    type Row = {
      id: string
      entity_type: EntityType
      canonical_name: string
      aliases: string[] | null
      metadata: Record<string, unknown> | null
      created_at: string
      updated_at: string
      event_entities: {
        events: { captured_at: string; is_deleted: boolean } | null
      }[]
    }

    const { data, error } = await supabase
      .from('entities')
      .select(
        `id, entity_type, canonical_name, aliases, metadata, created_at, updated_at,
         event_entities(events(captured_at, is_deleted))`
      )
      .in('entity_type', ['person', 'organisation'])
      .order('canonical_name')
      .returns<Row[]>()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const summaries = (data ?? []).map((e) => {
      const events = (e.event_entities || [])
        .map((j) => j.events)
        .filter((ev): ev is { captured_at: string; is_deleted: boolean } =>
          ev !== null && !ev.is_deleted
        )
      const lastContactAt =
        events.length > 0
          ? events
              .map((ev) => ev.captured_at)
              .sort()
              .reverse()[0]
          : null
      return {
        id: e.id,
        entity_type: e.entity_type,
        canonical_name: e.canonical_name,
        aliases: e.aliases ?? [],
        metadata: e.metadata ?? {},
        created_at: e.created_at,
        updated_at: e.updated_at,
        event_count: events.length,
        last_contact_at: lastContactAt,
      }
    })

    // Sort: most recently contacted first, unseen last, then alphabetical.
    summaries.sort((a, b) => {
      if (a.last_contact_at && b.last_contact_at) {
        return b.last_contact_at.localeCompare(a.last_contact_at)
      }
      if (a.last_contact_at) return -1
      if (b.last_contact_at) return 1
      return a.canonical_name.localeCompare(b.canonical_name)
    })

    return NextResponse.json(summaries)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
