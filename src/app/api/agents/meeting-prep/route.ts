import { NextResponse } from 'next/server'
import { resolveAgentUser } from '@/lib/agents/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { runMeetingPrep } from '@/lib/agents/meeting-prep'
import { sendPushToUser } from '@/lib/push/send'

export const maxDuration = 60

const LEAD_MINUTES = 90

/**
 * Scans for meetings starting within the next LEAD_MINUTES that have not yet
 * been prepped, produces a brief for each, and pushes it. Intended to run every
 * ~15 minutes via Vercel Cron.
 */
export async function POST(request: Request) {
  try {
    const userId = await resolveAgentUser(request)
    const admin = createAdminClient()

    const now = Date.now()
    const windowEnd = new Date(now + LEAD_MINUTES * 60_000).toISOString()

    const { data: due } = await admin
      .from('calendar_events')
      .select('id, summary, starts_at')
      .eq('user_id', userId)
      .eq('is_cancelled', false)
      .is('prep_sent_at', null)
      .gte('starts_at', new Date(now).toISOString())
      .lte('starts_at', windowEnd)
      .order('starts_at', { ascending: true })

    const prepped: string[] = []
    for (const m of due ?? []) {
      const meeting = m as { id: string; summary: string | null; starts_at: string }
      const result = await runMeetingPrep(userId, meeting.id)
      if (result) {
        prepped.push(meeting.id)
        await sendPushToUser(userId, {
          title: result.title,
          body: `${meeting.summary || 'Meeting'} at ${meeting.starts_at.slice(11, 16)} — tap for your brief`,
          url: `/dashboard`,
          tag: `prep-${meeting.id}`,
        })
      }
    }

    return NextResponse.json({ ok: true, prepped: prepped.length })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[agents/meeting-prep] Error:', err)
    return NextResponse.json({ error: 'Meeting-prep failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
