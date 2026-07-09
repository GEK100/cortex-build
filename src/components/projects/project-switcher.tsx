'use client'

import { ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useProjects } from '@/lib/projects/context'
import { ALL, GENERAL } from '@/lib/projects/util'

/**
 * Compact space selector for the header. Sets the active project, which both
 * files new captures and filters every view. 'All projects' files new captures
 * to General.
 */
export function ProjectSwitcher() {
  const { projects, active, setActive } = useProjects()
  const router = useRouter()

  function onChange(value: string) {
    setActive(value)
    // Server-rendered views (dashboard) read the mirrored cookie, so refresh
    // them; client views re-fetch off context on their own.
    router.refresh()
  }

  return (
    <div className="relative flex items-center">
      <select
        value={active}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Active project"
        className="max-w-[9rem] cursor-pointer appearance-none truncate rounded-md border border-border bg-background py-1 pl-2 pr-6 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value={ALL}>All projects</option>
        <option value={GENERAL}>General</option>
        {projects.length > 0 && <option disabled>──────────</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-muted-foreground" />
    </div>
  )
}
