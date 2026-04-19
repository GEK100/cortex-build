/**
 * TypeScript types mirroring the Supabase database schema.
 * Keep in sync with schema.sql.
 */

export type EventType = 'voice' | 'text' | 'photo' | 'email'

export type ExtractionStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'skipped'

export type LabelType =
  | 'rfi'
  | 'tq'
  | 'commitment'
  | 'decision'
  | 'risk'
  | 'variation'
  | 'snag'
  | 'site_diary'
  | 'meeting_note'
  | 'observation'
  | 'thought'

export type EntityType =
  | 'person'
  | 'organisation'
  | 'trade_package'
  | 'location'
  | 'drawing'
  | 'document'

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed'

// ---- Table row types ----

export interface Event {
  id: string
  user_id: string
  event_type: EventType
  created_at: string
  captured_at: string
  raw_content: string | null
  edited_content: string | null
  audio_url: string | null
  photo_url: string | null
  audio_duration_seconds: number | null
  photo_caption_raw: string | null
  photo_caption_edited: string | null
  ocr_text: string | null
  extraction_status: ExtractionStatus
  extraction_run_at: string | null
  is_deleted: boolean
  deleted_at: string | null
  source_device: string | null
  offline_id: string | null
  updated_at: string
}

export interface EventLabel {
  id: string
  event_id: string
  label: LabelType
  confidence: number
  reasoning: string | null
  created_at: string
}

export interface Entity {
  id: string
  user_id: string
  entity_type: EntityType
  canonical_name: string
  aliases: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface EventEntity {
  id: string
  event_id: string
  entity_id: string
  role: string | null
  context: string | null
  created_at: string
}

export interface ExtractionResult {
  id: string
  event_id: string
  model_used: string
  raw_response: Record<string, unknown>
  parsed_result: Record<string, unknown>
  sentiment: Sentiment | null
  significance: number | null
  timeline_worthy: boolean
  timeline_headline: string | null
  linked_event_ids: string[]
  tokens_used: number | null
  latency_ms: number | null
  created_at: string
}

export interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  table_name: string
  record_id: string
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ---- Insert types (for creating new rows) ----

export interface EventInsert {
  event_type: EventType
  raw_content?: string | null
  audio_url?: string | null
  photo_url?: string | null
  audio_duration_seconds?: number | null
  photo_caption_raw?: string | null
  ocr_text?: string | null
  captured_at?: string
  source_device?: string | null
  offline_id?: string | null
}

export interface EventUpdate {
  edited_content?: string | null
  photo_caption_edited?: string | null
  is_deleted?: boolean
  deleted_at?: string | null
  extraction_status?: ExtractionStatus
  extraction_run_at?: string | null
}

// ---- Event with related data ----

export interface EventWithExtraction extends Event {
  event_labels: EventLabel[]
  event_entities: (EventEntity & { entity: Entity })[]
  extraction_results: ExtractionResult[]
}
