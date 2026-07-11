'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, Boxes } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/config'
import { PRIMARY_NAV, SECONDARY_NAV, isActive, type NavItem } from './nav-items'
import { ProjectSwitcher } from '@/components/projects/project-switcher'

/** Persistent desktop rail. Hidden below md — mobile uses the bottom nav. */
export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card md:flex">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
          <Boxes className="h-4 w-4" strokeWidth={2} />
        </div>
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
          {APP_NAME}
        </span>
      </div>

      {/* Active project */}
      <div className="border-b border-border px-3 py-3">
        <p className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Project
        </p>
        <ProjectSwitcher fullWidth />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavGroup label="Workspace" items={PRIMARY_NAV} pathname={pathname} />
        <div className="mt-6">
          <NavGroup label="Records" items={SECONDARY_NAV} pathname={pathname} />
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <SidebarLink
          item={{ href: '/settings', label: 'Settings', icon: Settings }}
          active={isActive(pathname, '/settings')}
        />
      </div>
    </aside>
  )
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: NavItem[]
  pathname: string
}) {
  return (
    <div>
      <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </div>
  )
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const { href, label, icon: Icon } = item
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}
        strokeWidth={active ? 2.2 : 1.8}
      />
      {label}
    </Link>
  )
}
