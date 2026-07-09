import { NextResponse } from 'next/server'
import { resolveAgentUser } from '@/lib/agents/access'
import { runWeeklyReviewer } from '@/lib/agents/weekly-reviewer'
import { sendPushToUser } from '@/lib/push/send'

export const maxDuration = 120

/** Weekly reviewer (Opus) — Sunday 20:00. */
export async function POST(request: Request) {
  try {
    const userId = await resolveAgentUser(request)
    const { body } = await runWeeklyReviewer(userId)
    await sendPushToUser(userId, {
      title: 'Your weekly review is ready',
      body: 'The week just gone, the week ahead, and a few decisions to make.',
      url: '/outputs',
      tag: 'weekly-review',
    })
    return NextResponse.json({ ok: true, length: body.length })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[agents/weekly-review] Error:', err)
    return NextResponse.json({ error: 'Weekly review failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
