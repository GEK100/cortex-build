import type { EntityType } from '@/lib/db/types'

interface EntityChipProps {
  name: string
  entityType: EntityType
}

const TYPE_LABELS: Record<EntityType, string> = {
  person: 'Person',
  organisation: 'Org',
  trade_package: 'Trade',
  location: 'Location',
  drawing: 'Drawing',
  document: 'Document',
}

export function EntityChip({ name, entityType }: EntityChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <span className="font-medium text-foreground">{name}</span>
      <span className="opacity-60">{TYPE_LABELS[entityType]}</span>
    </span>
  )
}
