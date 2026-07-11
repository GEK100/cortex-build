'use client'

import { useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RecordingIndicator } from './recording-indicator'
import { useRecorder } from '@/lib/hooks/use-recorder'
import { useOnlineStatus } from '@/lib/hooks/use-online-status'
import { transcribeAudio } from '@/lib/media/transcribe'
import { enqueueCapture } from '@/lib/offline/queue'
import { useProjects } from '@/lib/projects/context'
import { toast } from 'sonner'

export function VoiceRecorder() {
  const { isRecording, duration, start, stop } = useRecorder()
  const [processing, setProcessing] = useState(false)
  const isOnline = useOnlineStatus()
  const { captureProjectId } = useProjects()

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
              project_id: captureProjectId,
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
            projectId: captureProjectId,
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
    <div className="flex flex-col items-center gap-5 py-8">
      {isRecording && <RecordingIndicator duration={duration} />}

      <div className="relative">
        {isRecording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-destructive/30" />
        )}
        <Button
          onClick={handleToggle}
          disabled={processing}
          variant={isRecording ? 'destructive' : 'default'}
          size="lg"
          className="relative h-20 w-20 rounded-full p-0 shadow-float ring-4 ring-primary/10 data-[recording=true]:ring-destructive/15"
          data-recording={isRecording}
        >
          {isRecording ? (
            <Square className="h-7 w-7" />
          ) : processing ? (
            <span className="text-xs">…</span>
          ) : (
            <Mic className="h-7 w-7" />
          )}
        </Button>
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {processing ? 'Processing…' : isRecording ? 'Tap to stop' : 'Tap to record'}
      </p>
    </div>
  )
}
