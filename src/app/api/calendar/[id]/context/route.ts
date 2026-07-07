import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { createEvent } from '@/lib/events/create'

/**
 * Captures a context note against a future meeting (build prompt §capture 5).
 * The note is an ordinary event — it flows through the same extraction pipeline
 * — and the calendar row is linked to it so the meeting-prep agent (Week 4) and
 * the dashboard can surface "you meant to raise X here".
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const { content } = await request.json()
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }

    // Confirm the meeting belongs to this user before linking.
    const { data: meeting } = await supabase
      .from('calendar_events')
      .select('id, summary')
      .eq('id', params.id)
      .maybeSingle()

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const { event } = await createEvent(
      supabase,
      user.id,
      {
        event_type: 'text',
        raw_content: content.trim(),
        source_device: 'calendar_context',
        source_metadata: {
          origin: 'calendar_context',
          calendar_event_id: params.id,
          meeting_summary: meeting.summary,
        },
      },
      { trigger: 'inline' }
    )

    // Pre-link the most recent context note onto the meeting.
    await supabase
      .from('calendar_events')
      .update({ context_event_id: event.id })
      .eq('id', params.id)

    return NextResponse.json({ event_id: event.id }, { status: 201 })
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
