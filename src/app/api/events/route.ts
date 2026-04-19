import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { writeAuditLog } from '@/lib/audit/log'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const eventType = searchParams.get('type')

    let query = supabase
      .from('events')
      .select('*, event_labels(*)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await assertAuthorisedUser(supabase)

    const body = await request.json()
    const {
      event_type,
      raw_content,
      audio_url,
      photo_url,
      audio_duration_seconds,
      photo_caption_raw,
      ocr_text,
      captured_at,
      source_device,
      offline_id,
    } = body

    if (!event_type || !['voice', 'text', 'photo', 'email'].includes(event_type)) {
      return NextResponse.json(
        { error: 'Invalid or missing event_type' },
        { status: 400 }
      )
    }

    // Deduplication on offline_id
    if (offline_id) {
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('offline_id', offline_id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(existing, { status: 200 })
      }
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        event_type,
        raw_content: raw_content ?? null,
        audio_url: audio_url ?? null,
        photo_url: photo_url ?? null,
        audio_duration_seconds: audio_duration_seconds ?? null,
        photo_caption_raw: photo_caption_raw ?? null,
        ocr_text: ocr_text ?? null,
        captured_at: captured_at ?? new Date().toISOString(),
        source_device: source_device ?? null,
        offline_id: offline_id ?? null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log — fire and forget
    writeAuditLog({
      userId: user.id,
      action: 'event.create',
      tableName: 'events',
      recordId: data.id,
      afterData: data,
    })

    // Trigger extraction asynchronously (fire and forget)
    const origin = request.headers.get('origin') || request.headers.get('host') || ''
    const protocol = origin.startsWith('localhost') ? 'http' : 'https'
    const baseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`

    fetch(`${baseUrl}/api/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ event_id: data.id }),
    }).catch((err) => {
      console.error('[events] Failed to trigger extraction:', err)
    })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
