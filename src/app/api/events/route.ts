import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'
import { createEvent } from '@/lib/events/create'

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

    const { event, deduped } = await createEvent(
      supabase,
      user.id,
      {
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
      },
      {
        trigger: 'http',
        origin: request.headers.get('origin') || request.headers.get('host') || '',
        cookie: request.headers.get('cookie') || '',
      }
    )

    return NextResponse.json(event, { status: deduped ? 200 : 201 })
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
