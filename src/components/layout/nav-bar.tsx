'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mic, Clock, Users, CheckSquare, MessageSquare, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Capture', icon: Mic },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/actions', label: 'Actions', icon: CheckSquare },
  { href: '/stakeholders', label: 'People', icon: Users },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
]

export function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-border bg-background/95 backdrop-blur-sm">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors',
              isActive
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
