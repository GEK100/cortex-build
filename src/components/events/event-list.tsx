'use client'

import { useEffect, useState, useCallback } from 'react'
import { EventCard } from './event-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Event, EventLabel } from '@/lib/db/types'

type EventWithLabels = Event & { event_labels: EventLabel[] }

export function EventList() {
  const [events, setEvents] = useState<EventWithLabels[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events')
      if (res.ok) {
        const data = await res.json()
        setEvents(data)
      }
    } catch {
      // Silently fail — will retry on next poll or navigation
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()

    // Poll every 10 seconds for fresh data (extraction results may arrive)
    const interval = setInterval(fetchEvents, 10000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  if (loading) {
    return (
      <div className="space-y-3 px-4 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No events captured yet. Use the Capture tab to get started.
      </div>
    )
  }

  return (
    <div>
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  )
}
