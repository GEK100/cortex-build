import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { processExtraction } from '@/lib/extraction/process'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const { event_id } = await request.json()
    if (!event_id) {
      return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })
    }

    const result = await processExtraction(event_id, user.id)

    if (result.status === 'already_complete') {
      return NextResponse.json({ status: 'already_complete' })
    }

    if (result.status === 'failed') {
      return NextResponse.json(
        { error: 'Extraction failed', status: 'failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'complete',
      labels: result.parsed?.labels.map((l) => l.label) ?? [],
      entities: result.parsed?.entities.map((e) => e.name) ?? [],
      significance: result.parsed?.significance,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[extract] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
