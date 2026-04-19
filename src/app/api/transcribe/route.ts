import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertAuthorisedUser } from '@/lib/auth/guard'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    await assertAuthorisedUser(supabase)

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Forward to OpenAI Whisper API
    const openaiForm = new FormData()
    openaiForm.append('file', audioFile, 'recording.webm')
    openaiForm.append('model', 'whisper-1')
    openaiForm.append('language', 'en')

    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: openaiForm,
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('[transcribe] Whisper API error:', err)
      return NextResponse.json(
        { error: 'Transcription failed' },
        { status: 502 }
      )
    }

    const result = await response.json()
    return NextResponse.json({ text: result.text })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[transcribe] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
