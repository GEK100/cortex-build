import { DecisionList } from '@/components/decisions/decision-list'
import { PageHeader, PageShell } from '@/components/layout/page-header'

export default function DecisionsPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="On the record" title="Decisions" subtitle="Every decision, who made it, and when." />
      <DecisionList />
    </PageShell>
  )
}
