import { TimelineView } from '@/components/timeline/timeline-view'

export default function TimelinePage() {
  return (
    <main>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-medium tracking-tight">Timeline</h2>
      </div>
      <TimelineView />
    </main>
  )
}
