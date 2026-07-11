'use client'

import { ChevronsUpDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useProjects } from '@/lib/projects/context'
import { ALL, GENERAL } from '@/lib/projects/util'

/**
 * Space selector. Sets the active project, which both files new captures and
 * filters every view. 'All projects' files new captures to General.
 * `fullWidth` is used in the sidebar; the compact form sits in the mobile header.
 */
export function ProjectSwitcher({ fullWidth = false }: { fullWidth?: boolean }) {
  const { projects, active, setActive } = useProjects()
  const router = useRouter()

  function onChange(value: string) {
    setActive(value)
    // Server-rendered views (dashboard) read the mirrored cookie, so refresh
    // them; client views re-fetch off context on their own.
    router.refresh()
  }

  return (
    <div className={cn('relative flex items-center', fullWidth && 'w-full')}>
      <select
        value={active}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Active project"
        className={cn(
          'cursor-pointer appearance-none truncate rounded-md border border-input bg-background font-medium text-foreground shadow-xs transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background',
          fullWidth
            ? 'w-full py-2 pl-3 pr-8 text-sm'
            : 'max-w-[9rem] py-1.5 pl-2.5 pr-7 text-xs'
        )}
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
      <ChevronsUpDown
        className={cn(
          'pointer-events-none absolute text-muted-foreground',
          fullWidth ? 'right-2.5 h-3.5 w-3.5' : 'right-2 h-3 w-3'
        )}
      />
    </div>
  )
}
