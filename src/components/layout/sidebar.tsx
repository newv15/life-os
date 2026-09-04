'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, SETTINGS_ITEM, isActivePath } from '@/lib/navigation'
import { signOut } from '@/app/login/actions'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigazione principale"
      className="hidden w-56 shrink-0 flex-col border-r border-rule bg-sidebar px-3 py-5 md:flex"
    >
      <Link href="/" className="mb-8 block border-l-2 border-primary pl-3">
        <span className="font-heading text-lg leading-none">Life OS</span>
      </Link>

      <ul className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <SidebarLink item={item} active={isActivePath(pathname, item.href)} />
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-0.5 border-t border-rule pt-4">
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

function SidebarLink({
  item,
  active,
}: {
  item: (typeof NAV_ITEMS)[number]
  active: boolean
}) {
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
