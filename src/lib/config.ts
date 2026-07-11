/**
 * Application-wide configuration constants.
 * The APP_NAME string appears here and in rendered UI only --
 * never in table names, route names, class names, or env vars.
 */

export const APP_NAME = 'Cortex'

export const ALLOWED_EMAIL = 'gareth@ictusflow.com'

/**
 * Strict model tiering (build prompt §3.6):
 *   - Haiku  — cheap classification / scan passes (gap-finder scan)
 *   - Sonnet — structured extraction, chat, synthesis, meeting-prep
 *   - Opus   — the weekly reviewer only (Sunday strategic pass)
 * Never use a heavier tier where a lighter one will do.
 */
export const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-20250514',
} as const

export type ModelTier = keyof typeof MODELS

export const LABEL_COLOURS: Record<string, string> = {
  rfi: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  tq: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  commitment: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  decision: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  risk: 'bg-red-500/15 text-red-300 border-red-500/30',
  variation: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  snag: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  site_diary: 'bg-stone-500/15 text-stone-300 border-stone-500/30',
  meeting_note: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  observation: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
  thought: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
}
