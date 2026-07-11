'use client'

import Link from 'next/link'
import { Settings, Search, Folder, Boxes } from 'lucide-react'
import { APP_NAME } from '@/lib/config'
import { useOnlineStatus } from '@/lib/hooks/use-online-status'
import { ProjectSwitcher } from '@/components/projects/project-switcher'

export function AppHeader() {
  const isOnline = useOnlineStatus()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/85 px-4 backdrop-blur-md md:px-6">
      {/* Brand — mobile only (desktop shows it in the sidebar). */}
      <Link href="/" className="flex items-center gap-2.5 md:hidden">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-glow">
          <Boxes className="h-4 w-4" strokeWidth={2} />
        </div>
        <span className="font-display text-base font-bold uppercase tracking-[0.16em] text-foreground">
          {APP_NAME}
        </span>
      </Link>

      {/* Desktop left — quiet console label. */}
      <span className="hidden text-xs font-medium uppercase tracking-wider text-muted-foreground md:block">
        Site Intelligence Console
      </span>

      {/* Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Project switcher — mobile only (sidebar has it on desktop). */}
        <div className="md:hidden">
          <ProjectSwitcher />
        </div>

        {/* Connection status pill */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          title={isOnline ? 'Online' : 'Offline'}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-success' : 'bg-warning'}`} />
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </span>

        <Link
          href="/search"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Link>

        {/* Projects + settings — mobile only (sidebar has them on desktop). */}
        <Link
          href="/projects"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
          aria-label="Manage projects"
        >
          <Folder className="h-4 w-4" />
        </Link>
        <Link
          href="/settings"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  )
}
