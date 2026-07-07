'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function CalendarConnect({ connected }: { connected: boolean }) {
  const [syncing, setSyncing] = useState(false)

  async function syncNow() {
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      toast.success(`Synced ${data.synced} event${data.synced === 1 ? '' : 's'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (!connected) {
    return (
      <Button asChild size="sm">
        <a href="/api/calendar/connect">Connect Google Calendar</a>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-green-700">Connected</span>
      <Button size="sm" variant="outline" onClick={syncNow} disabled={syncing}>
        {syncing ? 'Syncing…' : 'Sync now'}
      </Button>
      <a href="/api/calendar/connect" className="text-xs text-muted-foreground underline">
        Reconnect
      </a>
    </div>
  )
}
