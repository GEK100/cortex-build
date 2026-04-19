import Link from 'next/link'
import { Mic, Type, Camera, Mail } from 'lucide-react'
import { LabelBadge } from './label-badge'
import type { Event, EventLabel } from '@/lib/db/types'

interface EventCardProps {
  event: Event & { event_labels: EventLabel[] }
}

const typeIcons = {
  voice: Mic,
  text: Type,
  photo: Camera,
  email: Mail,
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EventCard({ event }: EventCardProps) {
  const Icon = typeIcons[event.event_type] || Type
  const content =
    event.edited_content || event.raw_content || event.photo_caption_raw || ''
  const firstLine = content.split('\n')[0]?.slice(0, 120) || 'No content'

  return (
    <Link
      href={`/events/${event.id}`}
      className="block border-b border-border px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{firstLine}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {formatTime(event.captured_at)}
            </span>
            {event.extraction_status === 'processing' && (
              <span className="text-[10px] text-muted-foreground">
                Extracting...
              </span>
            )}
          </div>
          {event.event_labels && event.event_labels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {event.event_labels.map((el) => (
                <LabelBadge
                  key={el.id}
                  label={el.label}
                  confidence={el.confidence}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
