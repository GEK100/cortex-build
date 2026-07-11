'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Users, Building2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { StakeholderSummary, EntityType } from '@/lib/db/types'

const typeIcons: Partial<Record<EntityType, typeof Users>> = {
  person: Users,
  organisation: Building2,
}

const TYPE_FILTERS: { value: 'all' | 'person' | 'organisation'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'person', label: 'People' },
  { value: 'organisation', label: 'Organisations' },
]

function formatLastContact(dateStr: string | null): string {
  if (!dateStr) return 'No contact yet'
  const then = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function staleness(dateStr: string | null): 'fresh' | 'ageing' | 'cold' | 'none' {
  if (!dateStr) return 'none'
  const days = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  if (days < 7) return 'fresh'
  if (days < 30) return 'ageing'
  return 'cold'
}

export function StakeholderList() {
  const [stakeholders, setStakeholders] = useState<StakeholderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'person' | 'organisation'>('all')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/stakeholders')
        if (res.ok) setStakeholders(await res.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return stakeholders.filter((s) => {
      if (typeFilter !== 'all' && s.entity_type !== typeFilter) return false
      if (!q) return true
      if (s.canonical_name.toLowerCase().includes(q)) return true
      return s.aliases?.some((a) => a.toLowerCase().includes(q)) ?? false
    })
  }, [stakeholders, query, typeFilter])

  if (loading) {
    return (
      <div className="space-y-2 px-4 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-2 border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stakeholders"
            className="h-8 pl-7 text-sm"
          />
        </div>
        <div className="flex gap-1 text-[11px]">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                typeFilter === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
          {stakeholders.length === 0
            ? 'No stakeholders yet. They appear automatically as extraction identifies them.'
            : 'No stakeholders match.'}
        </div>
      ) : (
        <ul>
          {filtered.map((s) => {
            const Icon = typeIcons[s.entity_type] || Users
            const stale = staleness(s.last_contact_at)
            return (
              <li key={s.id}>
                <Link
                  href={`/stakeholders/${s.id}`}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{s.canonical_name}</p>
                    {s.aliases && s.aliases.length > 0 && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        aka {s.aliases.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-right">
                    <span
                      className={cn(
                        'text-[11px] tabular-nums',
                        stale === 'fresh' && 'text-foreground',
                        stale === 'ageing' && 'text-muted-foreground',
                        stale === 'cold' && 'text-destructive/70',
                        stale === 'none' && 'text-muted-foreground/60'
                      )}
                    >
                      {formatLastContact(s.last_contact_at)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {s.event_count} event{s.event_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
