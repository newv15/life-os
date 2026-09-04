'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, isActivePath } from '@/lib/navigation'

/**
 * Phone navigation. Not a shrunken sidebar: only the screens actually opened
 * on a phone are here, and the rest live behind Impostazioni on desktop.
 *
 * The AI command button belongs in the centre of this bar and arrives in M3,
 * together with the command bar it opens - a button that opens nothing would
 * be worse than its absence.
 */
export function BottomNav() {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => item.mobile)

  return (
    <nav
      aria-label="Navigazione"
      className="sticky bottom-0 z-20 border-t border-rule bg-sidebar/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
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
      </ul>
    </nav>
  )
}
