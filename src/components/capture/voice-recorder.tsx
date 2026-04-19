'use client'

import { useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RecordingIndicator } from './recording-indicator'
import { useRecorder } from '@/lib/hooks/use-recorder'
import { useOnlineStatus } from '@/lib/hooks/use-online-status'
import { transcribeAudio } from '@/lib/media/transcribe'
import { enqueueCapture } from '@/lib/offline/queue'
import { toast } from 'sonner'

export function VoiceRecorder() {
  const { isRecording, duration, start, stop } = useRecorder()
  const [processing, setProcessing] = useState(false)
  const isOnline = useOnlineStatus()

  async function handleToggle() {
    if (isRecording) {
      setProcessing(true)
      try {
        const { blob, durationSeconds } = await stop()

        if (isOnline) {
          toast.info('Transcribing...')

          // Upload audio to storage
          const uploadForm = new FormData()
          uploadForm.append('file', blob, `voice-${Date.now()}.webm`)
          uploadForm.append('type', 'audio')
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: uploadForm,
          })
          const uploadData = uploadRes.ok ? await uploadRes.json() : null

          // Transcribe
          const transcript = await transcribeAudio(blob)

          // Create event
          const res = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: 'voice',
              raw_content: transcript,
              audio_url: uploadData?.path || null,
              audio_duration_seconds: Math.round(durationSeconds),
            }),
          })

          if (!res.ok) throw new Error('Failed to save')

          toast.success('Captured')
        } else {
          // Offline: save audio blob to IndexedDB for later sync
          const arrayBuffer = await blob.arrayBuffer()
          await enqueueCapture({
            eventType: 'voice',
            rawContent: null,
            audioBlob: arrayBuffer,
          })
          toast.success('Captured offline — will transcribe and sync when reconnected')
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to capture voice note'
        )
      } finally {
        setProcessing(false)
      }
    } else {
      try {
        await start()
      } catch {
        toast.error('Microphone access denied')
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {isRecording && <RecordingIndicator duration={duration} />}

      <Button
        onClick={handleToggle}
        disabled={processing}
        variant={isRecording ? 'destructive' : 'default'}
        size="lg"
        className="h-16 w-16 rounded-full p-0"
      >
        {isRecording ? (
          <Square className="h-6 w-6" />
        ) : processing ? (
          <span className="text-xs">...</span>
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        {processing
          ? 'Processing...'
          : isRecording
            ? 'Tap to stop'
            : 'Tap to record'}
      </p>
    </div>
  )
}
