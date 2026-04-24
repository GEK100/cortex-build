import { StakeholderList } from '@/components/stakeholders/stakeholder-list'

export default function StakeholdersPage() {
  return (
    <main>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-medium tracking-tight">Stakeholders</h2>
      </div>
      <StakeholderList />
    </main>
  )
}
