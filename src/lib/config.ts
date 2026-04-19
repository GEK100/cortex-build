/**
 * Application-wide configuration constants.
 * The APP_NAME string appears here and in rendered UI only --
 * never in table names, route names, class names, or env vars.
 */

export const APP_NAME = 'Cortex'

export const ALLOWED_EMAIL = 'gareth@ictusflow.com'

export const LABEL_COLOURS: Record<string, string> = {
  rfi: 'bg-blue-100 text-blue-700 border-blue-200',
  tq: 'bg-teal-100 text-teal-700 border-teal-200',
  commitment: 'bg-green-100 text-green-700 border-green-200',
  decision: 'bg-amber-100 text-amber-700 border-amber-200',
  risk: 'bg-red-100 text-red-700 border-red-200',
  variation: 'bg-orange-100 text-orange-700 border-orange-200',
  snag: 'bg-rose-100 text-rose-700 border-rose-200',
  site_diary: 'bg-stone-100 text-stone-600 border-stone-200',
  meeting_note: 'bg-purple-100 text-purple-700 border-purple-200',
  observation: 'bg-lime-100 text-lime-700 border-lime-200',
  thought: 'bg-violet-100 text-violet-600 border-violet-200',
}
