'use client'

import { useOnlineStatus } from '@/lib/hooks/use-online-status'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="sticky top-14 z-20 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-center text-xs font-medium text-warning">
      Offline — captures will sync when reconnected
    </div>
  )
}
