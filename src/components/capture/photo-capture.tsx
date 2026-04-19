'use client'

import { useState, useRef } from 'react'
import { Camera, Mic, Square, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRecorder } from '@/lib/hooks/use-recorder'
import { RecordingIndicator } from './recording-indicator'
import { transcribeAudio } from '@/lib/media/transcribe'
import { toast } from 'sonner'

export function PhotoCapture() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { isRecording, duration, start, stop } = useRecorder()

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  async function handleCaptionToggle() {
    if (isRecording) {
      try {
        const { blob } = await stop()
        toast.info('Transcribing caption...')
        const text = await transcribeAudio(blob)
        setCaption(text)
      } catch {
        toast.error('Failed to record caption')
      }
    } else {
      try {
        await start()
      } catch {
        toast.error('Microphone access denied')
      }
    }
  }

  async function handleSubmit() {
    if (!file) return

    setSaving(true)
    try {
      // Upload photo
      const uploadForm = new FormData()
      uploadForm.append('file', file, file.name)
      uploadForm.append('type', 'photo')
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadForm,
      })

      if (!uploadRes.ok) throw new Error('Upload failed')
      const uploadData = await uploadRes.json()

      // Create event
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'photo',
          raw_content: caption,
          photo_url: uploadData.path,
          photo_caption_raw: caption,
        }),
      })

      if (!res.ok) throw new Error('Failed to save')

      // Reset state
      setPreview(null)
      setFile(null)
      setCaption(null)
      toast.success('Captured')
    } catch {
      toast.error('Failed to save photo')
    } finally {
      setSaving(false)
    }
  }

  function handleClear() {
    setPreview(null)
    setFile(null)
    setCaption(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!preview) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          size="lg"
          className="h-16 w-16 rounded-full p-0"
        >
          <Camera className="h-6 w-6" />
        </Button>
        <p className="text-xs text-muted-foreground">Tap to take photo</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Photo preview */}
      <div className="relative">
        <img
          src={preview}
          alt="Preview"
          className="max-h-48 w-full rounded border border-border object-contain"
        />
        <button
          onClick={handleClear}
          className="absolute top-1 right-1 rounded-full bg-background/80 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Voice caption */}
      {caption && (
        <p className="rounded bg-muted px-3 py-2 text-sm text-foreground">
          {caption}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleCaptionToggle}
          variant="outline"
          size="sm"
          disabled={saving}
          className="flex-1"
        >
          {isRecording ? (
            <>
              <Square className="mr-1 h-3 w-3" />
              Stop
            </>
          ) : (
            <>
              <Mic className="mr-1 h-3 w-3" />
              {caption ? 'Re-record caption' : 'Add voice caption'}
            </>
          )}
        </Button>
        <Button
          onClick={handleSubmit}
          size="sm"
          disabled={saving || isRecording}
          className="flex-1"
        >
          <Send className="mr-1 h-3 w-3" />
          {saving ? 'Saving...' : 'Capture'}
        </Button>
      </div>

      {isRecording && (
        <div className="flex justify-center">
          <RecordingIndicator duration={duration} />
        </div>
      )}
    </div>
  )
}
