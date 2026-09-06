'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, MoreHorizontal, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { openCommandPalette } from '@/components/layout/command-palette'
import { NAV_GROUPS, NAV_ITEMS, SETTINGS_ITEM, isActivePath } from '@/lib/navigation'
import { signOut } from '@/app/login/actions'

/**
 * Phone navigation.
 *
 * Not a shrunken sidebar: four things fit across a phone, so only the screens
 * genuinely opened on one get a slot, and everything else lives behind a panel.
 * Which four is decided by how often each is opened standing up, not by how
 * the data is organised.
 */
export function BottomNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const primary = NAV_ITEMS.filter((item) => item.mobile)
  const rest = NAV_ITEMS.filter((item) => !item.mobile)

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label="Chiudi il menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/20"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-rule bg-card px-5 pt-5 pb-8">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                openCommandPalette()
              }}
              className="mb-5 flex w-full items-center gap-2 rounded-md border border-rule px-3 py-2.5 text-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Search className="size-4 shrink-0" aria-hidden />
              Cerca
            </button>

            {NAV_GROUPS.map((group) => {
              const items = group.items.filter((item) => rest.includes(item))
              if (items.length === 0) return null

              return (
                <div key={group.label} className="mb-4">
                  <p className="eyebrow mb-2">{group.label}</p>
                  <ul className="grid grid-cols-3 gap-2">
                    {items.map((item) => {
                      const Icon = item.icon
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="flex flex-col items-center gap-1 rounded-md py-3 text-xs text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <Icon className="size-5" aria-hidden />
                            {item.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}

            <div className="flex items-center justify-between border-t border-rule pt-4">
              <Link
                href={SETTINGS_ITEM.href}
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground"
              >
                Impostazioni
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <LogOut className="size-4" aria-hidden />
                  Esci
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Navigazione"
        className="sticky bottom-0 z-20 border-t border-rule bg-sidebar/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-4">
          {primary.map((item) => {
            const active = isActivePath(pathname, item.href)
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1 px-1 py-2.5 text-[0.6875rem] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            )
          })}

          <li>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[0.6875rem] text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <MoreHorizontal className="size-5" aria-hidden />
              Altro
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
