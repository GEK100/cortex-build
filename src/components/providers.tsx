'use client'

import { useEffect } from 'react'
import { initSyncListener } from '@/lib/offline/sync'
import { ProjectProvider } from '@/lib/projects/context'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('[sw] Registration failed:', err)
      })

      // Listen for sync messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'flush-queue') {
          import('@/lib/offline/queue').then(({ flushQueue }) => flushQueue())
        }
      })
    }

    // Initialise offline sync listener
    initSyncListener()
  }, [])

  return <ProjectProvider>{children}</ProjectProvider>
}
