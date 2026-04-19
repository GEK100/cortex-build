import { EventList } from '@/components/events/event-list'

export default function EventsPage() {
  return (
    <main>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-medium tracking-tight">Events</h2>
      </div>
      <EventList />
    </main>
  )
}
