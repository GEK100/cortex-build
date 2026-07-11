'use client'

import { usePathname } from 'next/navigation'
import { AppHeader } from './app-header'
import { NavBar } from './nav-bar'
import { Sidebar } from './sidebar'
import { OfflineBanner } from './offline-banner'

/** Routes that render bare, without the app chrome (sidebar/header/nav). */
const BARE_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare = BARE_PREFIXES.some((r) => pathname === r || pathname.startsWith(`${r}/`) || pathname.startsWith(r))

  if (bare) return <>{children}</>

  return (
    <>
      {/* Desktop: persistent left rail. Mobile: hidden (bottom nav instead). */}
      <Sidebar />

      {/* Content column, offset by the sidebar on desktop. */}
      <div className="flex min-h-screen flex-col md:pl-[15rem]">
        <AppHeader />
        <OfflineBanner />
        <div className="flex-1 pb-20 md:pb-10">{children}</div>
      </div>

      {/* Mobile bottom nav. */}
      <NavBar />
    </>
  )
}
