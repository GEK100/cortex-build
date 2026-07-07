import { DecisionList } from '@/components/decisions/decision-list'

export default function DecisionsPage() {
  return (
    <main>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-medium tracking-tight">Decisions</h2>
      </div>
      <DecisionList />
    </main>
  )
}
