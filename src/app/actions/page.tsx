import { ActionList } from '@/components/actions/action-list'
import { PageHeader, PageShell } from '@/components/layout/page-header'

export default function ActionsPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Open loops" title="Actions" subtitle="Commitments, RFIs and TQs — what's owed and by whom." />
      <ActionList />
    </PageShell>
  )
}
