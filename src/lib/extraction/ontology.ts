import { z } from 'zod'

export const LABEL_TYPES = [
  'rfi', 'tq', 'commitment', 'decision', 'risk',
  'variation', 'snag', 'site_diary', 'meeting_note',
  'observation', 'thought',
] as const

export type LabelType = (typeof LABEL_TYPES)[number]

export const ENTITY_TYPES = [
  'person', 'organisation', 'trade_package', 'location',
  'drawing', 'document',
] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

export const extractedLabelSchema = z.object({
  label: z.enum(LABEL_TYPES),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
})

export const extractedEntitySchema = z.object({
  name: z.string(),
  entity_type: z.enum(ENTITY_TYPES),
  role: z.string().optional(),
  context: z.string().optional(),
})

export const ACTION_SOURCE_KINDS = ['commitment', 'rfi', 'tq'] as const
export type ActionSourceKind = (typeof ACTION_SOURCE_KINDS)[number]

export const extractedActionSchema = z.object({
  description: z.string().min(1),
  source_kind: z.enum(ACTION_SOURCE_KINDS).default('commitment'),
  owner_name: z.string().nullable().optional(),
  raised_by_name: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
})

export type ExtractedAction = z.infer<typeof extractedActionSchema>

export const extractionResultSchema = z.object({
  labels: z.array(extractedLabelSchema).min(1),
  entities: z.array(extractedEntitySchema),
  actions: z.array(extractedActionSchema).optional().default([]),
  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  significance: z.number().int().min(1).max(5),
  timeline_worthy: z.boolean(),
  timeline_headline: z.string().nullable(),
  linked_event_hints: z.array(z.string()).optional(),
  summary: z.string(),
  corrected_content: z.string().optional(),
})

export type ExtractionResult = z.infer<typeof extractionResultSchema>
