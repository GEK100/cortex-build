import { TimelineView } from '@/components/timeline/timeline-view'
import { PageHeader, PageShell } from '@/components/layout/page-header'

export default function TimelinePage() {
  return (
    <PageShell size="wide">
      <PageHeader eyebrow="What happened" title="Timeline" subtitle="Significant events across the active project." />
      <TimelineView />
    </PageShell>
  )
}
