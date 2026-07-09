/**
 * Shared helpers for the active-project selection. The "active project" is a
 * single client-held value that does double duty: it decides where new
 * captures are filed AND which project the views filter to. It is one of:
 *   'all'      — no filter; new captures fall to General
 *   'general'  — the built-in General space (events.project_id IS NULL)
 *   <uuid>     — a specific project
 *
 * Persisted to localStorage (instant client reads) and mirrored to a cookie so
 * the server-rendered dashboard can scope without a round-trip.
 */
export const ACTIVE_PROJECT_COOKIE = 'cortex_active_project'
export const ALL = 'all'
export const GENERAL = 'general'

/**
 * The `project_id` query-param / API value for the active selection, or null
 * when no filter should be applied. 'none' means "General" (IS NULL) to the API.
 */
export function toFilterParam(active: string): string | null {
  if (!active || active === ALL) return null
  if (active === GENERAL) return 'none'
  return active
}

/** The project_id a new capture should be filed under (null = General). */
export function toCaptureProjectId(active: string): string | null {
  if (!active || active === ALL || active === GENERAL) return null
  return active
}
