import { openDB, type DBSchema } from 'idb'

interface CortexOfflineDB extends DBSchema {
  pendingEvents: {
    key: string
    value: {
      id: string
      eventType: 'voice' | 'text' | 'photo'
      rawContent: string | null
      capturedAt: string
      audioBlob: ArrayBuffer | null
      photoBlob: ArrayBuffer | null
      photoCaptionRaw: string | null
      status: 'pending' | 'syncing' | 'failed'
      retryCount: number
      createdAt: string
    }
    indexes: {
      'by-status': string
      'by-created': string
    }
  }
}

export function openCortexDB() {
  return openDB<CortexOfflineDB>('cortex-offline', 1, {
    upgrade(db) {
      const store = db.createObjectStore('pendingEvents', { keyPath: 'id' })
      store.createIndex('by-status', 'status')
      store.createIndex('by-created', 'createdAt')
    },
  })
}
