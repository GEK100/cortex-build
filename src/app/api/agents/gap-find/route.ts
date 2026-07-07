import { NextResponse } from 'next/server'
import { resolveAgentUser } from '@/lib/agents/access'
import { runGapFinder } from '@/lib/agents/gap-finder'

export const maxDuration = 60

/** Nightly gap-finder — runs after the synthesiser. */
export async function POST(request: Request) {
  try {
    const userId = await resolveAgentUser(request)
    const { body } = await runGapFinder(userId)
    return NextResponse.json({ ok: true, length: body.length })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[agents/gap-find] Error:', err)
    return NextResponse.json({ error: 'Gap-finder failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
