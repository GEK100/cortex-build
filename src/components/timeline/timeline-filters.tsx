'use client'

import { LABEL_TYPES } from '@/lib/extraction/ontology'
import { LABEL_COLOURS } from '@/lib/config'
import { cn } from '@/lib/utils'
import type { LabelType } from '@/lib/db/types'

export type DateRange = '7d' | '30d' | '90d' | 'all'

export interface TimelineFiltersState {
  minSignificance: number
  dateRange: DateRange
  labels: Set<LabelType>
}

interface TimelineFiltersProps {
  state: TimelineFiltersState
  onChange: (state: TimelineFiltersState) => void
}

const SIG_OPTIONS = [1, 2, 3, 4, 5] as const
const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All' },
]

const LABEL_DISPLAY: Record<LabelType, string> = {
  rfi: 'RFI',
  tq: 'TQ',
  commitment: 'Commitments',
  decision: 'Decisions',
  risk: 'Risks',
  variation: 'Variations',
  snag: 'Snags',
  site_diary: 'Site diary',
  meeting_note: 'Meetings',
  observation: 'Observations',
  thought: 'Thoughts',
}

export function TimelineFilters({ state, onChange }: TimelineFiltersProps) {
  const toggleLabel = (label: LabelType) => {
    const next = new Set(state.labels)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    onChange({ ...state, labels: next })
  }

  const clearLabels = () => onChange({ ...state, labels: new Set() })

  return (
    <div className="space-y-3 border-b border-border bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-wide text-muted-foreground">Since</span>
          {DATE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onChange({ ...state, dateRange: value })}
              className={cn(
                'rounded-sm px-1.5 py-0.5 transition-colors',
                state.dateRange === value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-wide text-muted-foreground">
            Significance &ge;
          </span>
          {SIG_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...state, minSignificance: n })}
              className={cn(
                'w-5 rounded-sm py-0.5 text-center tabular-nums transition-colors',
                state.minSignificance === n
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          onClick={clearLabels}
          className={cn(
            'rounded-sm border px-2 py-0.5 text-[10px] transition-colors',
            state.labels.size === 0
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:text-foreground'
          )}
        >
          All types
        </button>
        {LABEL_TYPES.map((label) => {
          const active = state.labels.has(label)
          return (
            <button
              key={label}
              onClick={() => toggleLabel(label)}
              className={cn(
                'rounded-sm border px-2 py-0.5 text-[10px] font-medium transition-colors',
                active
                  ? LABEL_COLOURS[label]
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {LABEL_DISPLAY[label]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
