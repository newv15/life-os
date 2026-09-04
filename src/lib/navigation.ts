import {
  Banknote,
  CheckSquare,
  FolderKanban,
  Inbox,
  Settings,
  Sun,
  Target,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Shown in the mobile bottom bar. Space there is scarce, so this is a
   *  smaller set chosen by how often each screen is opened on a phone. */
  mobile?: boolean
}

/**
 * Order is by daily reach, not by data model tidiness: the day comes first,
 * then whatever landed in the inbox, then the work itself.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Oggi', icon: Sun, mobile: true },
  { href: '/inbox', label: 'Inbox', icon: Inbox, mobile: true },
  { href: '/tasks', label: 'Task', icon: CheckSquare, mobile: true },
  { href: '/finance', label: 'Finanze', icon: Banknote, mobile: true },
  { href: '/projects', label: 'Progetti', icon: FolderKanban },
  { href: '/goals', label: 'Obiettivi', icon: Target },
]

export const SETTINGS_ITEM: NavItem = {
  href: '/settings',
  label: 'Impostazioni',
  icon: Settings,
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
