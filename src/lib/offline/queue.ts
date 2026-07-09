import { openCortexDB } from './db'
import { v4 as uuid } from 'uuid'

export interface PendingCapture {
  eventType: 'voice' | 'text' | 'photo'
  projectId?: string | null
  rawContent: string | null
  audioBlob?: ArrayBuffer
  photoBlob?: ArrayBuffer
  photoCaptionRaw?: string
}

/**
 * Enqueue a capture for later sync. Used when the device is offline.
 * Returns the offline ID for deduplication.
 */
export async function enqueueCapture(capture: PendingCapture): Promise<string> {
  const db = await openCortexDB()
  const id = uuid()

  await db.put('pendingEvents', {
    id,
    eventType: capture.eventType,
    projectId: capture.projectId ?? null,
    rawContent: capture.rawContent,
    capturedAt: new Date().toISOString(),
    audioBlob: capture.audioBlob || null,
    photoBlob: capture.photoBlob || null,
    photoCaptionRaw: capture.photoCaptionRaw || null,
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  })

  // Request background sync if available
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready
      await (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-captures')
    } catch {
      // Background sync not available — will rely on online event
    }
  }

  return id
}

/**
 * Get count of pending items in the queue.
 */
export async function getPendingCount(): Promise<number> {
  const db = await openCortexDB()
  return db.countFromIndex('pendingEvents', 'by-status', 'pending')
}

/**
 * Flush the offline queue: sync all pending items to the server.
 */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const db = await openCortexDB()
  const pending = await db.getAllFromIndex('pendingEvents', 'by-created')

  let synced = 0
  let failed = 0

  for (const item of pending) {
    if (item.status === 'syncing') continue

    try {
      // Mark as syncing
      await db.put('pendingEvents', { ...item, status: 'syncing' })

      let rawContent = item.rawContent

      // If voice with audio blob, transcribe first
      if (item.eventType === 'voice' && item.audioBlob) {
        const formData = new FormData()
        formData.append(
          'audio',
          new Blob([item.audioBlob], { type: 'audio/webm;codecs=opus' }),
          'recording.webm'
        )
        const transcriptRes = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        })

        if (transcriptRes.ok) {
          const { text } = await transcriptRes.json()
          rawContent = text
        } else {
          throw new Error('Transcription failed')
        }
      }

      // Create event on server with offline_id for deduplication
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: item.eventType,
          project_id: item.projectId ?? null,
          raw_content: rawContent,
          offline_id: item.id,
          captured_at: item.capturedAt,
          photo_caption_raw: item.photoCaptionRaw,
        }),
      })

      if (res.ok) {
        await db.delete('pendingEvents', item.id)
        synced++
      } else {
        throw new Error(`Server returned ${res.status}`)
      }
    } catch (err) {
      console.error('[queue] Failed to sync item:', item.id, err)
      await db.put('pendingEvents', {
        ...item,
        status: 'failed',
        retryCount: item.retryCount + 1,
      })
      failed++
    }
  }

  return { synced, failed }
}
