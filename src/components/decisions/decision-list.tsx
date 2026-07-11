'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { DecisionStatus } from '@/lib/db/types'

interface DecisionRow {
  id: string
  statement: string
  rationale: string | null
  status: DecisionStatus
  decided_at: string
  source_event_id: string
  decided_by: { id: string; canonical_name: string } | null
}

const STATUSES: DecisionStatus[] = ['recorded', 'implemented', 'superseded', 'reversed']

const STATUS_STYLE: Record<DecisionStatus, string> = {
  recorded: 'bg-secondary text-secondary-foreground',
  implemented: 'bg-emerald-500/15 text-emerald-300',
  superseded: 'bg-amber-500/15 text-amber-300',
  reversed: 'bg-red-500/15 text-red-300',
}

export function DecisionList() {
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<DecisionStatus | 'all'>('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.append('status', filter)
    try {
      const res = await fetch(`/api/decisions?${params.toString()}`)
      if (res.ok) setDecisions(await res.json())
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  async function setStatus(id: string, status: DecisionStatus) {
    try {
      const res = await fetch(`/api/decisions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)))
    } catch {
      toast.error('Could not update decision')
    }
  }

  const visible = decisions.filter((d) =>
    query.trim() ? d.statement.toLowerCase().includes(query.toLowerCase()) : true
  )

  return (
    <div>
      <div className="space-y-2 border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap gap-1 text-[11px]">
          {(['all', ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-sm px-2 py-0.5 capitalize transition-colors',
                filter === s ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search decisions…"
          className="w-full rounded-sm border border-border bg-background px-2 py-1 text-xs"
        />
      </div>

      {loading ? (
        <div className="space-y-3 px-4 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          No decisions yet. Captures labelled as decisions appear here with a lifecycle.
        </div>
      ) : (
        <ul className="mx-auto max-w-2xl divide-y divide-border">
          {visible.map((d) => (
            <li key={d.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm">{d.statement}</p>
                <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] capitalize', STATUS_STYLE[d.status])}>
                  {d.status}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>{d.decided_at.slice(0, 10)}</span>
                {d.decided_by && <span>by {d.decided_by.canonical_name}</span>}
                <Link href={`/events/${d.source_event_id}`} className="underline hover:text-foreground">
                  source
                </Link>
              </div>
              {d.rationale && <p className="mt-1 text-xs text-muted-foreground">{d.rationale}</p>}
              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                {STATUSES.filter((s) => s !== d.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(d.id, s)}
                    className="rounded-sm border border-border px-1.5 py-0.5 capitalize text-muted-foreground hover:text-foreground"
                  >
                    mark {s}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
