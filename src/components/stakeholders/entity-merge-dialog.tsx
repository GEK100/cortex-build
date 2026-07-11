'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StakeholderSummary, EntityType } from '@/lib/db/types'

interface EntityMergeDialogProps {
  open: boolean
  sourceId: string
  sourceName: string
  sourceType: EntityType
  onClose: () => void
  onMerged: (targetId: string) => void
}

export function EntityMergeDialog({
  open,
  sourceId,
  sourceName,
  sourceType,
  onClose,
  onMerged,
}: EntityMergeDialogProps) {
  const [candidates, setCandidates] = useState<StakeholderSummary[]>([])
  const [query, setQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    async function load() {
      const res = await fetch('/api/stakeholders')
      if (res.ok) {
        const all: StakeholderSummary[] = await res.json()
        setCandidates(
          all.filter((s) => s.id !== sourceId && s.entity_type === sourceType)
        )
      }
    }
    load()
  }, [open, sourceId, sourceType])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(
      (s) =>
        s.canonical_name.toLowerCase().includes(q) ||
        s.aliases?.some((a) => a.toLowerCase().includes(q))
    )
  }, [candidates, query])

  async function merge(targetId: string, targetName: string) {
    if (
      !confirm(
        `Merge "${sourceName}" into "${targetName}"? This cannot be undone. All events linked to "${sourceName}" will move to "${targetName}", and "${sourceName}" will become an alias.`
      )
    )
      return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/stakeholders/${sourceId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId }),
      })
      if (res.ok) {
        toast.success(`Merged into ${targetName}`)
        onMerged(targetId)
      } else {
        const err = await res.json().catch(() => ({ error: 'Merge failed' }))
        toast.error(err.error || 'Merge failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-popover shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">Merge &ldquo;{sourceName}&rdquo; into&hellip;</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Pick the canonical entity. Events re-link; this one becomes an alias.
          </p>
        </div>

        <div className="px-4 py-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="h-8 text-sm"
            autoFocus
          />
        </div>

        <ul className="max-h-64 overflow-y-auto border-t border-border">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              No other {sourceType === 'person' ? 'people' : 'organisations'} found.
            </li>
          ) : (
            filtered.map((s) => (
              <li key={s.id}>
                <button
                  disabled={submitting}
                  onClick={() => merge(s.id, s.canonical_name)}
                  className="flex w-full items-center justify-between gap-2 border-b border-border px-4 py-2 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  <span className="truncate">{s.canonical_name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {s.event_count} event{s.event_count === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
