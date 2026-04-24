'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Building2, GitMerge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { TimelineItem } from '@/components/timeline/timeline-item'
import { EntityMergeDialog } from './entity-merge-dialog'
import type { Entity, EntityType, Sentiment, TimelineEvent } from '@/lib/db/types'

interface StakeholderDetailProps {
  id: string
}

interface StakeholderDetailResponse {
  entity: Entity
  events: TimelineEvent[]
  stats: {
    event_count: number
    last_contact_at: string | null
    sentiment: Record<'positive' | 'neutral' | 'negative' | 'mixed', number>
  }
}

const typeLabel: Record<EntityType, string> = {
  person: 'Person',
  organisation: 'Organisation',
  trade_package: 'Trade package',
  location: 'Location',
  drawing: 'Drawing',
  document: 'Document',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No contact yet'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  mixed: 'Mixed',
}

export function StakeholderDetail({ id }: StakeholderDetailProps) {
  const router = useRouter()
  const [data, setData] = useState<StakeholderDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [mergeOpen, setMergeOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/stakeholders/${id}`)
        if (res.ok) {
          setData(await res.json())
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Stakeholder not found.
      </div>
    )
  }

  const { entity, events, stats } = data
  const Icon = entity.entity_type === 'organisation' ? Building2 : Users
  const totalSentiment =
    stats.sentiment.positive +
    stats.sentiment.neutral +
    stats.sentiment.negative +
    stats.sentiment.mixed

  return (
    <div className="mx-auto max-w-2xl">
      <div className="px-4 py-4">
        <Link
          href="/stakeholders"
          className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Stakeholders
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {typeLabel[entity.entity_type]}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-medium tracking-tight">
              {entity.canonical_name}
            </h1>
            {entity.aliases && entity.aliases.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Also known as {entity.aliases.join(', ')}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMergeOpen(true)}
            className="gap-1.5 text-xs"
          >
            <GitMerge className="h-3 w-3" />
            Merge
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Last contact
            </p>
            <p className="mt-0.5 text-xs font-medium">
              {formatDate(stats.last_contact_at)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Events
            </p>
            <p className="mt-0.5 text-xs font-medium tabular-nums">
              {stats.event_count}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Open actions
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">—</p>
          </div>
        </div>

        {totalSentiment > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Sentiment across recent events
            </p>
            <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-sm bg-muted">
              {(['positive', 'neutral', 'mixed', 'negative'] as Sentiment[]).map(
                (s) => {
                  const n = stats.sentiment[s]
                  if (!n) return null
                  const pct = (n / totalSentiment) * 100
                  const bg =
                    s === 'positive'
                      ? 'bg-green-400'
                      : s === 'negative'
                        ? 'bg-red-400'
                        : s === 'mixed'
                          ? 'bg-amber-300'
                          : 'bg-stone-300'
                  return (
                    <div
                      key={s}
                      className={bg}
                      style={{ width: `${pct}%` }}
                      title={`${SENTIMENT_LABEL[s]}: ${n}`}
                    />
                  )
                }
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      <section>
        <h2 className="px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Recent contributions
        </h2>
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No captured events mention this stakeholder yet.
          </p>
        ) : (
          <div>
            {events.map((ev) => (
              <TimelineItem key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </section>

      <EntityMergeDialog
        open={mergeOpen}
        sourceId={entity.id}
        sourceName={entity.canonical_name}
        sourceType={entity.entity_type}
        onClose={() => setMergeOpen(false)}
        onMerged={(targetId) => {
          setMergeOpen(false)
          router.replace(`/stakeholders/${targetId}`)
        }}
      />
    </div>
  )
}
