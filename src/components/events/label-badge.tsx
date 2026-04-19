import { Badge } from '@/components/ui/badge'
import { LABEL_COLOURS } from '@/lib/config'
import type { LabelType } from '@/lib/db/types'

interface LabelBadgeProps {
  label: LabelType
  confidence?: number
}

const LABEL_DISPLAY: Record<LabelType, string> = {
  rfi: 'RFI',
  tq: 'TQ',
  commitment: 'Commitment',
  decision: 'Decision',
  risk: 'Risk',
  variation: 'Variation',
  snag: 'Snag',
  site_diary: 'Site diary',
  meeting_note: 'Meeting',
  observation: 'Observation',
  thought: 'Thought',
}

export function LabelBadge({ label, confidence }: LabelBadgeProps) {
  const colours = LABEL_COLOURS[label] || 'bg-muted text-muted-foreground'

  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium ${colours}`}
      title={confidence !== undefined ? `${(confidence * 100).toFixed(0)}% confidence` : undefined}
    >
      {LABEL_DISPLAY[label] || label}
    </Badge>
  )
}
