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

// ---- Actions ----

export type ActionStatus = 'open' | 'closed' | 'disputed' | 'cancelled'
export type ActionSourceKind = 'commitment' | 'rfi' | 'tq'

export interface Action {
  id: string
  user_id: string
  source_event_id: string
  description: string
  source_kind: ActionSourceKind
  raised_by_entity_id: string | null
  owner_entity_id: string | null
  raised_at: string
  due_at: string | null
  closed_at: string | null
  status: ActionStatus
  evidence: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// /api/actions list row: action row plus embedded owner/raised_by entity refs.
export interface ActionListRow {
  id: string
  description: string
  source_kind: ActionSourceKind
  status: ActionStatus
  raised_at: string
  due_at: string | null
  closed_at: string | null
  evidence: string | null
  source_event_id: string
  owner: { id: string; canonical_name: string; entity_type: EntityType } | null
  raised_by: { id: string; canonical_name: string; entity_type: EntityType } | null
}

// Row returned by /api/stakeholders list. Aggregates computed server-side.
export interface StakeholderSummary {
  id: string
  entity_type: EntityType
  canonical_name: string
  aliases: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  event_count: number
  last_contact_at: string | null
}

// ---- Week 4: decisions ----

export type DecisionStatus = 'recorded' | 'implemented' | 'superseded' | 'reversed'

export interface Decision {
  id: string
  user_id: string
  source_event_id: string
  statement: string
  rationale: string | null
  decided_by_entity_id: string | null
  decided_at: string
  status: DecisionStatus
  superseded_by: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// ---- Week 3: chat, calendar, email, agents ----

export interface CalendarEvent {
  id: string
  user_id: string
  provider: string
  external_id: string
  calendar_id: string | null
  summary: string | null
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string | null
  attendees: { email?: string; displayName?: string; responseStatus?: string }[]
  html_link: string | null
  context_event_id: string | null
  prep_sent_at: string | null
  is_cancelled: boolean
  synced_at: string
  created_at: string
  updated_at: string
}

export type AgentKind = 'synthesiser' | 'gap_finder' | 'meeting_prep' | 'weekly_reviewer'

export type AgentOutputKind =
  | 'tomorrow_brief'
  | 'gap_report'
  | 'meeting_prep'
  | 'weekly_review'

export interface AgentOutput {
  id: string
  user_id: string
  kind: AgentOutputKind
  ref_key: string
  ref_id: string | null
  title: string | null
  body: string
  data: Record<string, unknown>
  run_id: string | null
  created_at: string
  updated_at: string
}

// A single chat turn. Conversation state is session-only in v1 (AD:
// no persisted threads), so these types live only in request/response
// payloads, never in a table.
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type ChatMode = 'factual' | 'synthesis'

export interface ChatCitation {
  event_id: string
  captured_at: string
  headline: string
}

// Slim row returned by /api/timeline: only the fields the feed needs.
export interface TimelineEvent {
  id: string
  event_type: EventType
  captured_at: string
  raw_content: string | null
  edited_content: string | null
  photo_caption_raw: string | null
  photo_caption_edited: string | null
  extraction_status: ExtractionStatus
  event_labels: EventLabel[]
  extraction_results: Pick<
    ExtractionResult,
    'significance' | 'sentiment' | 'timeline_worthy' | 'timeline_headline'
  >[]
}
