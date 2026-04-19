'use client'

import { APP_NAME } from '@/lib/config'
import { useOnlineStatus } from '@/lib/hooks/use-online-status'

export function AppHeader() {
  const isOnline = useOnlineStatus()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-12 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm">
      <span className="text-sm font-semibold uppercase tracking-widest text-foreground">
        {APP_NAME}
      </span>
      <span
        className={`h-2 w-2 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-amber-500'
        }`}
        title={isOnline ? 'Online' : 'Offline'}
      />
    </header>
  )
}
