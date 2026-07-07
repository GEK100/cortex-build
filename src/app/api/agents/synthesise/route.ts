import { NextResponse } from 'next/server'
import { resolveAgentUser } from '@/lib/agents/access'
import { runSynthesiser } from '@/lib/agents/synthesiser'

export const maxDuration = 60

/** Nightly synthesiser — produces the tomorrow-brief. Scheduled ~22:00. */
export async function POST(request: Request) {
  try {
    const userId = await resolveAgentUser(request)
    const { body } = await runSynthesiser(userId)
    return NextResponse.json({ ok: true, length: body.length })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[agents/synthesise] Error:', err)
    return NextResponse.json({ error: 'Synthesiser failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
