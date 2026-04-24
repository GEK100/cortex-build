'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface ActionCloseDialogProps {
  open: boolean
  actionId: string
  description: string
  mode: 'close' | 'dispute'
  onClose: () => void
  onDone: () => void
}

const MODE_COPY = {
  close: {
    title: 'Close action',
    evidenceLabel: 'Evidence (optional)',
    placeholder: 'How was this closed? What landed, or where can it be verified?',
    submit: 'Mark closed',
  },
  dispute: {
    title: 'Dispute action',
    evidenceLabel: 'Reason (optional)',
    placeholder: 'Why is this disputed? What is the counterparty claiming?',
    submit: 'Mark disputed',
  },
}

export function ActionCloseDialog({
  open,
  actionId,
  description,
  mode,
  onClose,
  onDone,
}: ActionCloseDialogProps) {
  const [evidence, setEvidence] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const copy = MODE_COPY[mode]

  async function submit() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          evidence: evidence.trim() || undefined,
        }),
      })
      if (res.ok) {
        toast.success(mode === 'close' ? 'Action closed' : 'Action disputed')
        setEvidence('')
        onDone()
      } else {
        const err = await res.json().catch(() => ({ error: 'Update failed' }))
        toast.error(err.error || 'Update failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-md border border-border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium">{copy.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
            {description}
          </p>
        </div>

        <div className="space-y-2 px-4 py-3">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {copy.evidenceLabel}
          </label>
          <Textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder={copy.placeholder}
            rows={3}
            className="text-sm"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting}>
            {copy.submit}
          </Button>
        </div>
      </div>
    </div>
  )
}
