import { StakeholderDetail } from '@/components/stakeholders/stakeholder-detail'

export default function StakeholderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <main>
      <StakeholderDetail id={params.id} />
    </main>
  )
}
