'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { AudioRecorder } from '@/lib/media/recorder'

export function useRecorder() {
  const recorderRef = useRef<AudioRecorder | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    const recorder = new AudioRecorder()
    recorderRef.current = recorder
    await recorder.start()
    setIsRecording(true)
    setDuration(0)

    intervalRef.current = setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)
  }, [])

  const stop = useCallback(async () => {
    if (!recorderRef.current) throw new Error('No active recorder')

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const result = await recorderRef.current.stop()
    setIsRecording(false)
    setDuration(0)
    recorderRef.current = null

    return result
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (recorderRef.current?.isRecording) {
        recorderRef.current.stop().catch(() => {})
      }
    }
  }, [])

  return { isRecording, duration, start, stop }
}
