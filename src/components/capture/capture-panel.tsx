'use client'

import { useState } from 'react'
import { Mic, Type, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TextCapture } from './text-capture'
import { VoiceRecorder } from './voice-recorder'
import { PhotoCapture } from './photo-capture'

type CaptureMode = 'voice' | 'text' | 'photo'

const modes: { key: CaptureMode; label: string; icon: typeof Mic }[] = [
  { key: 'voice', label: 'Voice', icon: Mic },
  { key: 'text', label: 'Text', icon: Type },
  { key: 'photo', label: 'Photo', icon: Camera },
]

export function CapturePanel() {
  const [mode, setMode] = useState<CaptureMode>('voice')

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-secondary/60 p-1">
        {modes.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all',
              mode === key
                ? 'bg-card text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={mode === key ? 2.2 : 1.8} />
            {label}
          </button>
        ))}
      </div>

      {/* Capture surface */}
      {mode === 'voice' && <VoiceRecorder />}
      {mode === 'text' && <TextCapture />}
      {mode === 'photo' && <PhotoCapture />}
    </div>
  )
}
