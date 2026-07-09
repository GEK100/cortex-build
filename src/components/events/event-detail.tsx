'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Mic, Type, Camera, Mail } from 'lucide-react'
import Link from 'next/link'
import { LabelBadge } from './label-badge'
import { EntityChip } from './entity-chip'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useProjects } from '@/lib/projects/context'
import type { EventWithExtraction } from '@/lib/db/types'

interface EventDetailProps {
  eventId: string
}

const typeIcons = {
  voice: Mic,
  text: Type,
  photo: Camera,
  email: Mail,
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EventDetail({ eventId }: EventDetailProps) {
  const [event, setEvent] = useState<EventWithExtraction | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProject, setSavingProject] = useState(false)
  const { projects } = useProjects()

  async function reassignProject(value: string) {
    const projectId = value === 'general' ? null : value
    setSavingProject(true)
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEvent((prev) => (prev ? { ...prev, project_id: updated.project_id } : prev))
      }
    } finally {
      setSavingProject(false)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/${eventId}`)
        if (res.ok) {
          setEvent(await res.json())
        }
      } catch {
        // Will show error state
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId])

  if (loading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Event not found.
      </div>
    )
  }

  const Icon = typeIcons[event.event_type] || Type
  const extraction = event.extraction_results?.[0]

  return (
    <div className="px-4 py-4">
      {/* Back link */}
      <Link
        href="/events"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Events
      </Link>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {event.event_type}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(event.captured_at)}
        </span>
      </div>

      {/* Project — reassign the note to a different space */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Project
        </span>
        <select
          value={event.project_id ?? 'general'}
          onChange={(e) => reassignProject(e.target.value)}
          disabled={savingProject}
          aria-label="Project"
          className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
        >
          <option value="general">General</option>
          {event.project_id && !projects.some((p) => p.id === event.project_id) && (
            <option value={event.project_id}>(archived project)</option>
          )}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="mt-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {event.edited_content || event.raw_content || 'No content'}
        </p>
        {event.edited_content && event.raw_content && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[10px] text-muted-foreground">
              Original transcript
            </summary>
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
              {event.raw_content}
            </p>
          </details>
        )}
      </div>

      {/* Photo */}
      {event.photo_url && (
        <div className="mt-4">
          <img
            src={event.photo_url}
            alt="Captured photo"
            className="max-h-64 rounded border border-border object-contain"
          />
        </div>
      )}

      {/* OCR text */}
      {event.ocr_text && (
        <div className="mt-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Extracted text
          </span>
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
            {event.ocr_text}
          </p>
        </div>
      )}

      <Separator className="my-4" />

      {/* Labels */}
      {event.event_labels && event.event_labels.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Labels
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {event.event_labels.map((el) => (
              <LabelBadge
                key={el.id}
                label={el.label}
                confidence={el.confidence}
              />
            ))}
          </div>
        </div>
      )}

      {/* Entities */}
      {event.event_entities && event.event_entities.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Entities
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {event.event_entities.map((ee) => (
              <EntityChip
                key={ee.id}
                name={ee.entity.canonical_name}
                entityType={ee.entity.entity_type}
              />
            ))}
          </div>
        </div>
      )}

      {/* Extraction metadata */}
      {extraction && (
        <div className="mt-3 space-y-1 text-[10px] text-muted-foreground">
          {extraction.significance && (
            <p>Significance: {extraction.significance}/5</p>
          )}
          {extraction.sentiment && <p>Sentiment: {extraction.sentiment}</p>}
          {extraction.timeline_worthy && extraction.timeline_headline && (
            <p>Timeline: {extraction.timeline_headline}</p>
          )}
        </div>
      )}

      {/* Extraction status */}
      {event.extraction_status === 'pending' && (
        <p className="mt-4 text-xs text-muted-foreground">
          Extraction pending...
        </p>
      )}
      {event.extraction_status === 'processing' && (
        <p className="mt-4 text-xs text-muted-foreground">
          Extracting...
        </p>
      )}
      {event.extraction_status === 'failed' && (
        <p className="mt-4 text-xs text-destructive">
          Extraction failed. Will appear in tomorrow-brief for manual review.
        </p>
      )}
    </div>
  )
}
