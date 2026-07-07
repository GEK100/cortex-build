'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { CalendarEvent } from '@/lib/db/types'

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function UpcomingMeetings({ days = 14 }: { days?: number }) {
  const [meetings, setMeetings] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar/events?days=${days}`)
      if (res.ok) setMeetings(await res.json())
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  async function saveNote(id: string) {
    const text = note.trim()
    if (!text) return
    setSaving(true)
    try {
      const res = await fetch(`/api/calendar/${id}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Context note captured')
      setNote('')
      setOpenId(null)
      load()
    } catch {
      toast.error('Could not save context note')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading…</p>
  }

  if (meetings.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nothing scheduled, or calendar not connected.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {meetings.map((m) => (
        <li key={m.id} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{m.summary || '(untitled)'}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatWhen(m.starts_at)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {m.location && <span className="truncate">{m.location}</span>}
            {m.context_event_id && <span className="text-green-700">note attached</span>}
            <button
              className="underline hover:text-foreground"
              onClick={() => {
                setOpenId(openId === m.id ? null : m.id)
                setNote('')
              }}
            >
              {openId === m.id ? 'cancel' : 'add context'}
            </button>
          </div>
          {openId === m.id && (
            <div className="mt-2 space-y-2">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. chase Tom on the stone interface detail"
                className="resize-none text-sm"
              />
              <Button size="sm" onClick={() => saveNote(m.id)} disabled={saving || !note.trim()}>
                {saving ? 'Saving…' : 'Capture context'}
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
