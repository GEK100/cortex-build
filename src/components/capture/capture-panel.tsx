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
      <div className="flex gap-1 rounded-md bg-muted p-1">
        {modes.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
              mode === key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
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
