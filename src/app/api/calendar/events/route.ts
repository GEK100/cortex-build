import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'

/**
 * Upcoming meetings from the local calendar cache. This is a list, not a
 * calendar UI (build prompt §3.5 / anti-scope) — it feeds the dashboard
 * "what's coming" panel and the context-note capture surface.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const { searchParams } = new URL(request.url)
    const days = Math.min(parseInt(searchParams.get('days') || '14', 10), 60)
    const now = new Date().toISOString()
    const until = new Date(Date.now() + days * 86400_000).toISOString()

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('is_cancelled', false)
      .gte('starts_at', now)
      .lte('starts_at', until)
      .order('starts_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
