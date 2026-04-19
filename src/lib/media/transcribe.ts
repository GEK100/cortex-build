/**
 * Posts an audio blob to the transcription API route.
 */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('audio', blob, 'recording.webm')

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Transcription failed' }))
    throw new Error(err.error || 'Transcription failed')
  }

  const { text } = await res.json()
  return text
}
