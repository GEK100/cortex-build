import { StakeholderList } from '@/components/stakeholders/stakeholder-list'
import { PageHeader, PageShell } from '@/components/layout/page-header'

export default function StakeholdersPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Who's involved" title="People" subtitle="Everyone on your projects and when you last spoke." />
      <StakeholderList />
    </PageShell>
  )
}
