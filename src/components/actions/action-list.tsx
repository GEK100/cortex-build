'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActionRow } from './action-row'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ActionListRow, ActionStatus, ActionSourceKind } from '@/lib/db/types'

type StatusFilter = 'active' | 'open' | 'closed' | 'disputed' | 'all'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'all', label: 'All' },
]

const SOURCE_FILTERS: { value: 'all' | ActionSourceKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'commitment', label: 'Commitments' },
  { value: 'rfi', label: 'RFIs' },
  { value: 'tq', label: 'TQs' },
]

function statusesFor(filter: StatusFilter): ActionStatus[] | null {
  switch (filter) {
    case 'active':
      return ['open']
    case 'open':
      return ['open']
    case 'closed':
      return ['closed']
    case 'disputed':
      return ['disputed']
    case 'all':
      return null
  }
}

function isOverdue(a: ActionListRow): boolean {
  return a.status === 'open' && a.due_at !== null && new Date(a.due_at) < new Date()
}

export function ActionList() {
  const [actions, setActions] = useState<ActionListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusFilter>('active')
  const [sourceKind, setSourceKind] = useState<'all' | ActionSourceKind>('all')

  const fetchActions = useCallback(async () => {
    const params = new URLSearchParams()
    const ss = statusesFor(status)
    if (ss) ss.forEach((s) => params.append('status', s))
    if (sourceKind !== 'all') params.append('source_kind', sourceKind)

    try {
      const res = await fetch(`/api/actions?${params.toString()}`)
      if (res.ok) {
        setActions(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [status, sourceKind])

  useEffect(() => {
    setLoading(true)
    fetchActions()
  }, [fetchActions])

  useEffect(() => {
    const interval = setInterval(fetchActions, 20000)
    return () => clearInterval(interval)
  }, [fetchActions])

  // Sort overdue-open to the top, then by due_at asc (with nulls last), then by raised_at desc.
  const sorted = useMemo(() => {
    const arr = [...actions]
    arr.sort((a, b) => {
      const overdueA = isOverdue(a)
      const overdueB = isOverdue(b)
      if (overdueA && !overdueB) return -1
      if (!overdueA && overdueB) return 1
      if (a.status === 'open' && b.status !== 'open') return -1
      if (a.status !== 'open' && b.status === 'open') return 1
      const dueA = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY
      const dueB = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY
      if (dueA !== dueB) return dueA - dueB
      return new Date(b.raised_at).getTime() - new Date(a.raised_at).getTime()
    })
    return arr
  }, [actions])

  const counts = useMemo(() => {
    const c = { open: 0, overdue: 0 }
    for (const a of actions) {
      if (a.status === 'open') {
        c.open++
        if (isOverdue(a)) c.overdue++
      }
    }
    return c
  }, [actions])

  return (
    <div>
      <div className="space-y-2 border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap gap-1 text-[11px]">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={cn(
                'rounded-sm px-2 py-0.5 transition-colors',
                status === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 text-[11px]">
          {SOURCE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSourceKind(value)}
              className={cn(
                'rounded-sm border px-2 py-0.5 transition-colors',
                sourceKind === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {!loading && (
          <p className="text-[10px] text-muted-foreground">
            {counts.open} open
            {counts.overdue > 0 && (
              <span className="ml-2 text-destructive">
                {counts.overdue} overdue
              </span>
            )}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 px-4 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          No actions match.
          <br />
          Commitments and RFIs captured in voice or text events will appear here after extraction.
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          {sorted.map((a) => (
            <ActionRow key={a.id} action={a} onUpdated={fetchActions} />
          ))}
        </div>
      )}
    </div>
  )
}
