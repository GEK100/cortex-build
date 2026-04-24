'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Check,
  XCircle,
  RotateCcw,
  User,
  Building2,
  Link2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActionListRow, ActionStatus } from '@/lib/db/types'
import { ActionCloseDialog } from './action-close-dialog'

interface ActionRowProps {
  action: ActionListRow
  onUpdated: () => void
}

const SOURCE_LABEL: Record<ActionListRow['source_kind'], string> = {
  commitment: 'Commitment',
  rfi: 'RFI',
  tq: 'TQ',
}

const STATUS_STYLES: Record<ActionStatus, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  closed: 'bg-stone-100 text-stone-600 border-stone-200',
  disputed: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-muted text-muted-foreground border-border',
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

function dueLabel(
  status: ActionStatus,
  dueAt: string | null,
  closedAt: string | null
): { text: string; tone: 'overdue' | 'soon' | 'neutral' | 'good' | 'bad' } {
  if (status === 'closed') {
    if (!dueAt || !closedAt) return { text: 'Closed', tone: 'neutral' }
    const delta = daysBetween(dueAt, closedAt)
    if (delta === 0) return { text: 'Closed on time', tone: 'good' }
    if (delta < 0) return { text: `Closed ${-delta}d early`, tone: 'good' }
    return { text: `Closed ${delta}d late`, tone: 'bad' }
  }
  if (status === 'disputed') return { text: 'Disputed', tone: 'bad' }
  if (status === 'cancelled') return { text: 'Cancelled', tone: 'neutral' }
  // open
  if (!dueAt) return { text: 'No due date', tone: 'neutral' }
  const delta = daysBetween(new Date().toISOString(), dueAt)
  if (delta < 0) return { text: `Overdue ${-delta}d`, tone: 'overdue' }
  if (delta === 0) return { text: 'Due today', tone: 'soon' }
  if (delta <= 3) return { text: `Due in ${delta}d`, tone: 'soon' }
  return { text: `Due in ${delta}d`, tone: 'neutral' }
}

const TONE_STYLE = {
  overdue: 'text-destructive font-medium',
  soon: 'text-amber-700 font-medium',
  neutral: 'text-muted-foreground',
  good: 'text-stone-600',
  bad: 'text-destructive/80',
} as const

export function ActionRow({ action, onUpdated }: ActionRowProps) {
  const [dialog, setDialog] = useState<'close' | 'dispute' | null>(null)
  const [busy, setBusy] = useState(false)

  const due = dueLabel(action.status, action.due_at, action.closed_at)
  const isOverdue = due.tone === 'overdue'

  async function reopen() {
    if (!confirm('Reopen this action?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/actions/${action.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' }),
      })
      if (res.ok) {
        toast.success('Reopened')
        onUpdated()
      } else {
        toast.error('Reopen failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const OwnerIcon =
    action.owner?.entity_type === 'organisation' ? Building2 : User

  return (
    <>
      <div className="group border-b border-border px-4 py-3 transition-colors hover:bg-muted/40">
        <div className="flex items-start gap-3">
          {isOverdue && (
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
              strokeWidth={2}
            />
          )}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-sm leading-snug',
                action.status === 'closed' && 'text-muted-foreground line-through decoration-muted-foreground/40',
                action.status === 'cancelled' && 'text-muted-foreground'
              )}
            >
              {action.description}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <span
                className={cn(
                  'rounded-sm border px-1.5 py-0.5 text-[10px] font-medium',
                  STATUS_STYLES[action.status]
                )}
              >
                {SOURCE_LABEL[action.source_kind]}
              </span>

              <span className={cn('tabular-nums', TONE_STYLE[due.tone])}>
                {due.text}
              </span>

              {action.owner && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <OwnerIcon className="h-3 w-3" strokeWidth={1.5} />
                  {action.owner.canonical_name}
                </span>
              )}

              <Link
                href={`/events/${action.source_event_id}`}
                className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                title="Open source event"
              >
                <Link2 className="h-3 w-3" strokeWidth={1.5} />
                Source
              </Link>
            </div>

            {action.evidence && (
              <p className="mt-1 text-[11px] italic text-muted-foreground">
                &ldquo;{action.evidence}&rdquo;
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {action.status === 'open' && (
              <>
                <button
                  disabled={busy}
                  onClick={() => setDialog('close')}
                  className="rounded-sm p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                  title="Mark closed"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
                <button
                  disabled={busy}
                  onClick={() => setDialog('dispute')}
                  className="rounded-sm p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                  title="Mark disputed"
                >
                  <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </>
            )}
            {(action.status === 'closed' ||
              action.status === 'disputed' ||
              action.status === 'cancelled') && (
              <button
                disabled={busy}
                onClick={reopen}
                className="rounded-sm p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                title="Reopen"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>
      </div>

      <ActionCloseDialog
        open={dialog !== null}
        actionId={action.id}
        description={action.description}
        mode={dialog ?? 'close'}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null)
          onUpdated()
        }}
      />
    </>
  )
}
