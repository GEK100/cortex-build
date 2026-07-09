'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Archive, ArchiveRestore, Check, X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProjects } from '@/lib/projects/context'
import { toast } from 'sonner'
import type { Project } from '@/lib/db/types'

export function ProjectsManager() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const { refresh: refreshSwitcher } = useProjects()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/projects?all=1')
      if (res.ok) setProjects(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create() {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setNewName('')
        await load()
        await refreshSwitcher()
        toast.success('Project created')
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Failed to create project' }))
        toast.error(error || 'Failed to create project')
      }
    } finally {
      setCreating(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>, successMsg: string) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      await load()
      await refreshSwitcher()
      toast.success(successMsg)
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Update failed' }))
      toast.error(error || 'Update failed')
    }
  }

  function startEdit(p: Project) {
    setEditingId(p.id)
    setEditName(p.name)
  }

  async function saveEdit(id: string) {
    const name = editName.trim()
    if (!name) return
    await patch(id, { name }, 'Renamed')
    setEditingId(null)
  }

  const active = projects.filter((p) => p.status === 'active')
  const archived = projects.filter((p) => p.status === 'archived')

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <p className="mb-4 text-xs text-muted-foreground">
        Projects are spaces to split your notes. Notes with no project live in{' '}
        <span className="font-medium text-foreground">General</span>. Pick the active project from the
        header — new captures are filed there.
      </p>

      {/* Create */}
      <div className="mb-6 flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="New project name…"
          disabled={creating}
          className="text-sm"
        />
        <Button onClick={create} disabled={creating || !newName.trim()} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="divide-y divide-border">
            {active.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">No projects yet.</p>
            )}
            {active.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 py-2">
                {editingId === p.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(p.id)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => saveEdit(p.id)} aria-label="Save" className="p-1 text-muted-foreground hover:text-foreground">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} aria-label="Cancel" className="p-1 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="truncate text-sm text-foreground">{p.name}</span>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => startEdit(p)} aria-label="Rename" className="p-1 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => patch(p.id, { status: 'archived' }, 'Archived')}
                        aria-label="Archive"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {archived.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Archived
              </h3>
              <div className="divide-y divide-border">
                {archived.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="truncate text-sm text-muted-foreground">{p.name}</span>
                    <button
                      onClick={() => patch(p.id, { status: 'active' }, 'Restored')}
                      aria-label="Restore"
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
