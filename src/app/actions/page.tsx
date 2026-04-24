import { ActionList } from '@/components/actions/action-list'

export default function ActionsPage() {
  return (
    <main>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-medium tracking-tight">Actions</h2>
      </div>
      <ActionList />
    </main>
  )
}
