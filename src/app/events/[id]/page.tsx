import { EventDetail } from '@/components/events/event-detail'

export default function EventDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <main>
      <EventDetail eventId={params.id} />
    </main>
  )
}
