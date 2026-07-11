'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PRIMARY_NAV, isActive } from './nav-items'

/** Mobile bottom nav — hidden on desktop (the sidebar takes over). */
export function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch justify-around border-t border-border bg-card/90 backdrop-blur-md md:hidden">
      {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
            <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
