/**
 * Applies the ?project_id= filter to a Supabase events query, server-side.
 *   - absent / null  → no filter (all projects)
 *   - 'none'         → General space (project_id IS NULL)
 *   - <uuid>         → that project
 *
 * `column` lets callers target a joined path (e.g. 'events.project_id').
 * Typed loosely because Supabase's fluent builder is not generically narrowable
 * across .eq/.is; the returned value is the same builder.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyProjectFilter<T extends { eq: any; is: any }>(
  query: T,
  projectParam: string | null | undefined,
  column = 'project_id'
): T {
  if (!projectParam) return query
  if (projectParam === 'none') return query.is(column, null)
  return query.eq(column, projectParam)
}
