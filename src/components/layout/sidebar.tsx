'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, SETTINGS_ITEM, isActivePath, type NavItem } from '@/lib/navigation'
import { signOut } from '@/app/login/actions'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigazione principale"
      className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-rule bg-sidebar px-3 py-5 md:flex"
    >
      <Link href="/" className="mb-7 block border-l-2 border-primary pl-3">
        <span className="font-heading text-lg leading-none">Life OS</span>
      </Link>

      <div className="flex-1 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="eyebrow mb-1.5 px-3">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} active={isActivePath(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-0.5 border-t border-rule pt-4">
        <SidebarLink
          item={SETTINGS_ITEM}
          active={isActivePath(pathname, SETTINGS_ITEM.href)}
        />
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            Esci
          </button>
        </form>
      </div>
    </nav>
  )
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  )
}
