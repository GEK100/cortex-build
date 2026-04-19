'use client'

import { useOnlineStatus } from '@/lib/hooks/use-online-status'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed top-12 left-0 right-0 z-40 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-800 border-b border-amber-200">
      Offline — captures will sync when reconnected
    </div>
  )
}
