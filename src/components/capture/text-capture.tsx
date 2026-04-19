'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { useOnlineStatus } from '@/lib/hooks/use-online-status'
import { enqueueCapture } from '@/lib/offline/queue'

export function TextCapture() {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const isOnline = useOnlineStatus()

  async function handleSubmit() {
    const text = content.trim()
    if (!text) return

    setSaving(true)
    try {
      if (isOnline) {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'text',
            raw_content: text,
          }),
        })

        if (!res.ok) throw new Error('Failed to save')

        toast.success('Captured')
      } else {
        await enqueueCapture({
          eventType: 'text',
          rawContent: text,
        })
        toast.success('Captured offline — will sync when reconnected')
      }

      setContent('')
    } catch {
      toast.error('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Quick note..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="resize-none text-sm"
        disabled={saving}
      />
      <Button
        onClick={handleSubmit}
        disabled={!content.trim() || saving}
        size="sm"
        className="w-full"
      >
        <Send className="mr-2 h-4 w-4" />
        {saving ? 'Saving...' : 'Capture'}
      </Button>
    </div>
  )
}
