import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit/log'
import type { ExtractionResult } from './ontology'

/**
 * Persists extraction results to the database:
 * - Upserts entities
 * - Inserts event_labels
 * - Inserts event_entities junction rows
 * - Inserts the full extraction_results row
 * - Updates the event extraction status
 */
export async function writeExtractionResults(
  eventId: string,
  userId: string,
  parsed: ExtractionResult,
  rawResponse: Record<string, unknown>,
  tokensUsed: number,
  latencyMs: number,
  model: string
): Promise<void> {
  const supabase = createAdminClient()

  // 1. Insert labels
  if (parsed.labels.length > 0) {
    const labelRows = parsed.labels.map((l) => ({
      event_id: eventId,
      label: l.label,
      confidence: l.confidence,
      reasoning: l.reasoning,
    }))

    const { error: labelErr } = await supabase
      .from('event_labels')
      .upsert(labelRows, { onConflict: 'event_id,label' })

    if (labelErr) {
      console.error('[persist] Failed to insert labels:', labelErr)
    }
  }

  // 2. Upsert entities and create junctions. Track id-by-name so the actions
  //    step can resolve owner_name / raised_by_name references without another round-trip.
  const entityIdByName = new Map<string, string>()

  for (const entity of parsed.entities) {
    const { data: entityRow, error: entityErr } = await supabase
      .from('entities')
      .upsert(
        {
          user_id: userId,
          entity_type: entity.entity_type,
          canonical_name: entity.name,
        },
        { onConflict: 'user_id,entity_type,canonical_name' }
      )
      .select('id')
      .single()

    if (entityErr || !entityRow) {
      console.error('[persist] Failed to upsert entity:', entity.name, entityErr)
      continue
    }

    entityIdByName.set(entity.name.toLowerCase(), entityRow.id)

    const { error: junctionErr } = await supabase
      .from('event_entities')
      .upsert(
        {
          event_id: eventId,
          entity_id: entityRow.id,
          role: entity.role || 'mentioned',
          context: entity.context || null,
        },
        { onConflict: 'event_id,entity_id,role' }
      )

    if (junctionErr) {
      console.error('[persist] Failed to insert junction:', junctionErr)
    }
  }

  // 2b. Insert actions extracted from this event.
  //     raised_at is set from the event's captured_at — that is the authoritative
  //     moment the obligation came into being, regardless of when extraction ran.
  if (parsed.actions && parsed.actions.length > 0) {
    const { data: eventRow } = await supabase
      .from('events')
      .select('captured_at')
      .eq('id', eventId)
      .single()
    const raisedAt = eventRow?.captured_at ?? new Date().toISOString()

    const actionRows = parsed.actions.map((a) => ({
      user_id: userId,
      source_event_id: eventId,
      description: a.description,
      source_kind: a.source_kind,
      owner_entity_id: a.owner_name
        ? (entityIdByName.get(a.owner_name.toLowerCase()) ?? null)
        : null,
      raised_by_entity_id: a.raised_by_name
        ? (entityIdByName.get(a.raised_by_name.toLowerCase()) ?? null)
        : null,
      raised_at: raisedAt,
      due_at: a.due_at ?? null,
    }))

    const { data: insertedActions, error: actionsErr } = await supabase
      .from('actions')
      .insert(actionRows)
      .select('id')

    if (actionsErr) {
      console.error('[persist] Failed to insert actions:', actionsErr)
    } else if (insertedActions && insertedActions.length > 0) {
      writeAuditLog({
        userId,
        action: 'actions.create',
        tableName: 'actions',
        recordId: eventId,
        afterData: {
          source_event_id: eventId,
          action_ids: insertedActions.map((a) => a.id),
          count: insertedActions.length,
        },
      })
    }
  }

  // 3. Insert full extraction result
  const { error: resultErr } = await supabase
    .from('extraction_results')
    .insert({
      event_id: eventId,
      model_used: model,
      raw_response: rawResponse,
      parsed_result: parsed as unknown as Record<string, unknown>,
      sentiment: parsed.sentiment,
      significance: parsed.significance,
      timeline_worthy: parsed.timeline_worthy,
      timeline_headline: parsed.timeline_headline,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
    })

  if (resultErr) {
    console.error('[persist] Failed to insert extraction result:', resultErr)
  }

  // 4. Update event status and corrected content if provided
  const eventUpdate: Record<string, unknown> = {
    extraction_status: 'complete',
    extraction_run_at: new Date().toISOString(),
  }

  // If extraction provided OCR text (for photos), store it
  if (parsed.corrected_content) {
    eventUpdate.edited_content = parsed.corrected_content
  }

  await supabase
    .from('events')
    .update(eventUpdate)
    .eq('id', eventId)

  // 5. Audit log
  writeAuditLog({
    userId,
    action: 'extraction.complete',
    tableName: 'events',
    recordId: eventId,
    afterData: {
      labels: parsed.labels.map((l) => l.label),
      entities: parsed.entities.map((e) => e.name),
      significance: parsed.significance,
      sentiment: parsed.sentiment,
    },
  })
}
