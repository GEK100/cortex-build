import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { assertCronRequest } from '@/lib/auth/cron'
import { resolveOwnerUserId } from '@/lib/auth/owner'
import { syncCalendar } from '@/lib/calendar/sync'

/**
 * Refreshes the local calendar cache. Callable two ways:
 *  - by the authorised user (manual "sync now")
 *  - by Vercel Cron (x-cron-secret / Bearer), which has no session
 */
async function handle(request: NextRequest) {
  let userId: string
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)
    userId = user.id
  } catch {
    // No user session — require the cron secret instead.
    assertCronRequest(request)
    userId = await resolveOwnerUserId()
  }

  try {
    const result = await syncCalendar(userId)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    const status = message.includes('not connected') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
