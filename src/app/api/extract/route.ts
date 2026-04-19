import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { runExtraction } from '@/lib/extraction/extract'
import { writeExtractionResults } from '@/lib/extraction/persist'
import { writeAuditLog } from '@/lib/audit/log'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const { event_id } = await request.json()

    if (!event_id) {
      return NextResponse.json(
        { error: 'Missing event_id' },
        { status: 400 }
      )
    }

    // Check if already extracted (idempotent)
    const adminClient = createAdminClient()
    const { data: event } = await adminClient
      .from('events')
      .select('extraction_status')
      .eq('id', event_id)
      .single()

    if (event?.extraction_status === 'complete') {
      return NextResponse.json({ status: 'already_complete' })
    }

    try {
      const { parsed, rawResponse, tokensUsed, latencyMs, model } =
        await runExtraction(event_id)

      await writeExtractionResults(
        event_id,
        user.id,
        parsed,
        rawResponse,
        tokensUsed,
        latencyMs,
        model
      )

      return NextResponse.json({
        status: 'complete',
        labels: parsed.labels.map((l) => l.label),
        entities: parsed.entities.map((e) => e.name),
        significance: parsed.significance,
      })
    } catch (extractionErr) {
      console.error('[extract] Pipeline failed:', extractionErr)

      // Mark event as failed — will surface in tomorrow-brief
      await adminClient
        .from('events')
        .update({ extraction_status: 'failed' })
        .eq('id', event_id)

      writeAuditLog({
        userId: user.id,
        action: 'extraction.failed',
        tableName: 'events',
        recordId: event_id,
        afterData: {
          error:
            extractionErr instanceof Error
              ? extractionErr.message
              : 'Unknown error',
        },
      })

      return NextResponse.json(
        { error: 'Extraction failed', status: 'failed' },
        { status: 500 }
      )
    }
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[extract] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
