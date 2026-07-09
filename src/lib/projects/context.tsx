'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Project } from '@/lib/db/types'
import { ACTIVE_PROJECT_COOKIE, ALL, toCaptureProjectId, toFilterParam } from './util'

interface ProjectContextValue {
  /** Active (non-archived) projects, ordered by name. */
  projects: Project[]
  /** Current selection: 'all' | 'general' | <project uuid>. */
  active: string
  setActive: (value: string) => void
  /** project_id for a new capture (null = General). */
  captureProjectId: string | null
  /** ?project_id= value for filtered API calls (null = no filter). */
  filterParam: string | null
  loading: boolean
  refresh: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

function writeCookie(value: string) {
  // Mirror to a cookie so server components (dashboard) can read the selection.
  document.cookie = `${ACTIVE_PROJECT_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [active, setActiveState] = useState<string>(ALL)
  const [loading, setLoading] = useState(true)

  // Hydrate the selection from localStorage on mount, then keep the cookie
  // in sync so the very first server render already has it.
  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_PROJECT_COOKIE) || ALL
    setActiveState(stored)
    writeCookie(stored)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) setProjects(await res.json())
    } catch {
      // Offline or transient — keep whatever we have.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setActive = useCallback((value: string) => {
    setActiveState(value)
    localStorage.setItem(ACTIVE_PROJECT_COOKIE, value)
    writeCookie(value)
  }, [])

  const value: ProjectContextValue = {
    projects,
    active,
    setActive,
    captureProjectId: toCaptureProjectId(active),
    filterParam: toFilterParam(active),
    loading,
    refresh,
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjects(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjects must be used within a ProjectProvider')
  return ctx
}
