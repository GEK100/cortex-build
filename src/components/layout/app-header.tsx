'use client'

import Link from 'next/link'
import { Settings } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { useOnlineStatus } from '@/lib/hooks/use-online-status'

export function AppHeader() {
  const isOnline = useOnlineStatus()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-12 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm">
      <span className="text-sm font-semibold uppercase tracking-widest text-foreground">
        {APP_NAME}
      </span>
      <div className="flex items-center gap-3">
        <span
          className={`h-2 w-2 rounded-full ${
            isOnline ? 'bg-green-500' : 'bg-amber-500'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  )
}
