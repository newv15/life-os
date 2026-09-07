import {
  Banknote,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Clock,
  FolderKanban,
  Inbox,
  ListChecks,
  Repeat,
  Settings,
  Sun,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Shown in the phone bar. Space is scarce there, so this is a short list. */
  mobile?: boolean
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

/**
 * Grouped by rhythm rather than by data model.
 *
 * The first group is what gets opened daily and often more than once; the
 * second is what you sit down with. Eleven flat entries would be a list nobody
 * reads, and alphabetical order would put Abitudini above Oggi.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Giornata',
    items: [
      { href: '/', label: 'Oggi', icon: Sun, mobile: true },
      { href: '/inbox', label: 'Inbox', icon: Inbox },
      { href: '/tasks', label: 'Task', icon: CheckSquare, mobile: true },
      { href: '/lists', label: 'Liste', icon: ListChecks },
      { href: '/calendar', label: 'Calendario', icon: CalendarDays },
      { href: '/habits', label: 'Abitudini', icon: Repeat },
    ],
  },
  {
    label: 'Vita',
    items: [
      { href: '/finance', label: 'Finanze', icon: Banknote, mobile: true },
      { href: '/projects', label: 'Progetti', icon: FolderKanban },
      { href: '/goals', label: 'Obiettivi', icon: Target },
      { href: '/journal', label: 'Diario', icon: BookOpen },
      { href: '/people', label: 'Persone', icon: Users },
      { href: '/time', label: 'Tempo', icon: Clock },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

export const SETTINGS_ITEM: NavItem = {
  href: '/settings',
  label: 'Impostazioni',
  icon: Settings,
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
