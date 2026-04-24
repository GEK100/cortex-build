import Link from 'next/link'
import { Mic, Type, Camera, Mail } from 'lucide-react'
import { LabelBadge } from '@/components/events/label-badge'
import type { TimelineEvent } from '@/lib/db/types'

interface TimelineItemProps {
  event: TimelineEvent
}

const typeIcons = {
  voice: Mic,
  text: Type,
  photo: Camera,
  email: Mail,
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function deriveHeadline(event: TimelineEvent): string {
  const extraction = event.extraction_results?.[0]
  if (extraction?.timeline_headline) return extraction.timeline_headline
  const content =
    event.edited_content ||
    event.raw_content ||
    event.photo_caption_edited ||
    event.photo_caption_raw ||
    ''
  return content.split('\n')[0]?.slice(0, 140) || 'Untitled capture'
}

export function TimelineItem({ event }: TimelineItemProps) {
  const Icon = typeIcons[event.event_type] || Type
  const extraction = event.extraction_results?.[0]
  const significance = extraction?.significance ?? 0
  const headline = deriveHeadline(event)

  return (
    <Link
      href={`/events/${event.id}`}
      className="group relative flex gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div className="flex w-12 shrink-0 flex-col items-start gap-1 pt-0.5">
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatTime(event.captured_at)}
        </span>
        {significance > 0 && (
          <span
            className="text-[10px] tabular-nums text-muted-foreground"
            title={`Significance ${significance}/5`}
          >
            {'•'.repeat(significance)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <Icon
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
            strokeWidth={1.5}
          />
          <p className="text-sm leading-snug text-foreground">{headline}</p>
        </div>
        {event.event_labels && event.event_labels.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
            {event.event_labels.map((el) => (
              <LabelBadge key={el.id} label={el.label} confidence={el.confidence} />
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
