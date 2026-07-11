import {
  Mic,
  LayoutDashboard,
  Clock,
  CheckSquare,
  Users,
  MessageSquare,
  Folder,
  Gavel,
  FileText,
  Search,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

/** Primary surfaces — also the mobile bottom nav. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Capture', icon: Mic },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/actions', label: 'Actions', icon: CheckSquare },
  { href: '/stakeholders', label: 'People', icon: Users },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
]

/** Records & tools — sidebar-only secondary group. */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/projects', label: 'Projects', icon: Folder },
  { href: '/decisions', label: 'Decisions', icon: Gavel },
  { href: '/outputs', label: 'Outputs', icon: FileText },
  { href: '/search', label: 'Search', icon: Search },
]

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}
