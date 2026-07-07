'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { Mic, Square, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useRecorder } from '@/lib/hooks/use-recorder'
import { transcribeAudio } from '@/lib/media/transcribe'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { ChatCitation } from '@/lib/db/types'

export interface ChatScope {
  entityId?: string
  eventId?: string
  scopeLabel?: string
  days?: number
}

interface Turn {
  role: 'user' | 'assistant'
  content: string
  citations?: ChatCitation[]
  provenance?: { eventCount: number; earliest: string | null; days: number }
}

/**
 * Renders assistant text, turning [E<n>] source markers into tap-to-open
 * links to the underlying event (build prompt §3.12 — factual claims carry
 * their evidence). Unknown markers are left as plain text.
 */
function renderWithCitations(text: string, citations: ChatCitation[]) {
  const parts = text.split(/(\[E\d+\])/g)
  return parts.map((part, i) => {
    const m = part.match(/^\[E(\d+)\]$/)
    if (!m) return <span key={i}>{part}</span>
    const idx = parseInt(m[1], 10) - 1
    const cite = citations[idx]
    if (!cite) return <span key={i}>{part}</span>
    return (
      <Link
        key={i}
        href={`/events/${cite.event_id}`}
        title={cite.headline}
        className="mx-0.5 rounded-sm bg-muted px-1 text-[10px] align-super text-muted-foreground hover:text-foreground"
      >
        E{m[1]}
      </Link>
    )
  })
}

export function ChatPanel({ scope }: { scope?: ChatScope }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const { isRecording, start, stop } = useRecorder()
  const [transcribing, setTranscribing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    })
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const history = [...turns, { role: 'user' as const, content: text }]
    setTurns([...history, { role: 'assistant', content: '', citations: [] }])
    setInput('')
    setStreaming(true)
    scrollToEnd()

    const patchLast = (fn: (t: Turn) => Turn) =>
      setTurns((prev) => {
        const next = [...prev]
        next[next.length - 1] = fn(next[next.length - 1])
        return next
      })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((t) => ({ role: t.role, content: t.content })),
          scope: scope ?? {},
        }),
      })

      if (!res.ok || !res.body) throw new Error('Chat request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          let msg: Record<string, unknown>
          try {
            msg = JSON.parse(line)
          } catch {
            continue
          }

          if (msg.type === 'meta') {
            patchLast((t) => ({
              ...t,
              citations: (msg.citations as ChatCitation[]) ?? [],
              provenance: {
                eventCount: (msg.eventCount as number) ?? 0,
                earliest: (msg.earliest as string) ?? null,
                days: (msg.days as number) ?? 30,
              },
            }))
          } else if (msg.type === 'text') {
            patchLast((t) => ({ ...t, content: t.content + (msg.text as string) }))
            scrollToEnd()
          } else if (msg.type === 'capture') {
            toast.success('Captured')
          } else if (msg.type === 'error') {
            patchLast((t) => ({
              ...t,
              content: t.content || `Sorry — ${msg.message as string}`,
            }))
          }
        }
      }
    } catch {
      toast.error('Chat failed')
      patchLast((t) => ({ ...t, content: t.content || 'Sorry — something went wrong.' }))
    } finally {
      setStreaming(false)
      scrollToEnd()
    }
  }, [input, streaming, turns, scope, scrollToEnd])

  const toggleVoice = useCallback(async () => {
    if (isRecording) {
      setTranscribing(true)
      try {
        const { blob } = await stop()
        const text = await transcribeAudio(blob)
        setInput((prev) => (prev ? `${prev} ${text}` : text))
      } catch {
        toast.error('Transcription failed')
      } finally {
        setTranscribing(false)
      }
    } else {
      try {
        await start()
      } catch {
        toast.error('Microphone access denied')
      }
    }
  }, [isRecording, start, stop])

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {turns.length === 0 && (
          <div className="mx-auto max-w-md pt-10 text-center text-sm text-muted-foreground">
            Ask about the project — what was said, what&apos;s outstanding, how a
            relationship is trending. Or capture something: &ldquo;note that Tom was
            off today&rdquo;.
          </div>
        )}

        {turns.map((turn, i) => (
          <div
            key={i}
            className={cn(
              'mx-auto max-w-2xl text-sm',
              turn.role === 'user' ? 'text-right' : 'text-left'
            )}
          >
            <div
              className={cn(
                'inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-left',
                turn.role === 'user'
                  ? 'bg-foreground text-background'
                  : 'bg-muted/40 text-foreground'
              )}
            >
              {turn.role === 'assistant'
                ? renderWithCitations(turn.content || '…', turn.citations ?? [])
                : turn.content}
            </div>
            {turn.role === 'assistant' &&
              turn.provenance &&
              turn.provenance.eventCount > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Drawn from {turn.provenance.eventCount} event
                  {turn.provenance.eventCount === 1 ? '' : 's'}
                  {turn.provenance.earliest
                    ? ` since ${turn.provenance.earliest.slice(0, 10)}`
                    : ''}
                </p>
              )}
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <Button
            type="button"
            size="sm"
            variant={isRecording ? 'destructive' : 'outline'}
            onClick={toggleVoice}
            disabled={transcribing}
            className="h-9 w-9 shrink-0 p-0"
            aria-label={isRecording ? 'Stop recording' : 'Voice input'}
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={transcribing ? 'Transcribing…' : 'Ask or capture…'}
            rows={1}
            className="max-h-32 min-h-9 resize-none text-sm"
            disabled={streaming}
          />
          <Button
            type="button"
            size="sm"
            onClick={send}
            disabled={!input.trim() || streaming}
            className="h-9 w-9 shrink-0 p-0"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
