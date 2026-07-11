import { EventList } from '@/components/events/event-list'
import { PageHeader, PageShell } from '@/components/layout/page-header'

export default function EventsPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Capture stream" title="Events" subtitle="Everything you've captured, newest first." />
      <EventList />
    </PageShell>
  )
}
