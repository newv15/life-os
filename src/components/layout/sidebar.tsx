'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { openCommandPalette } from '@/components/layout/command-palette'
import { useClientValue } from '@/hooks/use-client-value'
import { NAV_GROUPS, SETTINGS_ITEM, isActivePath, type NavItem } from '@/lib/navigation'
import { signOut } from '@/app/login/actions'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigazione principale"
      className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-rule bg-sidebar px-3 py-5 md:flex"
    >
      <Link href="/" className="mb-5 block border-l-2 border-primary pl-3">
        <span className="font-heading text-lg leading-none">Life OS</span>
      </Link>

      <SearchButton />

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

/**
 * The shortcut written where it can be learnt.
 *
 * A keyboard shortcut nobody is told about is a keyboard shortcut nobody uses,
 * and the modifier is read from the machine rather than assumed: printing ⌘ on
 * Windows teaches the wrong key.
 */
function SearchButton() {
  const modifier = useClientValue<string | null>(
    () => (/mac|iphone|ipad/i.test(navigator.userAgent) ? '⌘' : 'Ctrl'),
    null,
  )

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="mb-6 flex w-full items-center gap-2 rounded-md border border-rule bg-background/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      Cerca
      {modifier ? (
        <span className="data ml-auto text-[0.6875rem] tracking-tight">{modifier} K</span>
      ) : null}
    </button>
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
