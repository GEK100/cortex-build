'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { TimelineItem } from './timeline-item'
import {
  TimelineFilters,
  type TimelineFiltersState,
  type DateRange,
} from './timeline-filters'
import { Skeleton } from '@/components/ui/skeleton'
import { useProjects } from '@/lib/projects/context'
import type { LabelType, TimelineEvent } from '@/lib/db/types'

const DATE_RANGE_DAYS: Record<DateRange, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
}

function fromParam(range: DateRange): string | null {
  const days = DATE_RANGE_DAYS[range]
  if (days === null) return null
  const from = new Date()
  from.setDate(from.getDate() - days)
  return from.toISOString()
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (isSameDay(d, today)) return 'Today'
  if (isSameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

function dayKey(dateStr: string): string {
  return new Date(dateStr).toISOString().slice(0, 10)
}

export function TimelineView() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<TimelineFiltersState>({
    minSignificance: 3,
    dateRange: '30d',
    labels: new Set<LabelType>(),
  })
  const { filterParam } = useProjects()

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams({
      min_significance: String(filters.minSignificance),
      limit: '200',
    })
    const from = fromParam(filters.dateRange)
    if (from) params.set('from', from)
    if (filterParam) params.set('project_id', filterParam)

    try {
      const res = await fetch(`/api/timeline?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
      }
    } catch {
      // Silently fail — next poll will retry
    } finally {
      setLoading(false)
    }
  }, [filters.minSignificance, filters.dateRange, filterParam])

  useEffect(() => {
    setLoading(true)
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    const interval = setInterval(fetchEvents, 15000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  const filtered = useMemo(() => {
    if (filters.labels.size === 0) return events
    return events.filter((e) =>
      e.event_labels?.some((el) => filters.labels.has(el.label))
    )
  }, [events, filters.labels])

  const grouped = useMemo(() => {
    const groups = new Map<string, TimelineEvent[]>()
    for (const e of filtered) {
      const key = dayKey(e.captured_at)
      const list = groups.get(key) || []
      list.push(e)
      groups.set(key, list)
    }
    return Array.from(groups.entries())
  }, [filtered])

  return (
    <div>
      <TimelineFilters state={filters} onChange={setFilters} />

      {loading ? (
        <div className="space-y-3 px-4 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          Nothing on the timeline yet.
          <br />
          Captures with significance &ge; {filters.minSignificance} will appear here.
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          {grouped.map(([key, items]) => (
            <section key={key}>
              <h3 className="sticky top-14 z-10 mb-1 border-b border-border bg-background/80 px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-wider text-primary backdrop-blur-md">
                {formatDayHeader(items[0].captured_at)}
              </h3>
              {items.map((event) => (
                <TimelineItem key={event.id} event={event} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
