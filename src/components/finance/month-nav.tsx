import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMonthKey, shiftMonthKey } from '@/lib/utils/date'

/**
 * Moving between months.
 *
 * Links rather than buttons, so a month can be bookmarked, opened in another
 * tab, and reached with the back button - and so the whole thing works before
 * any JavaScript has loaded.
 *
 * The forward arrow stops at the current month: there is nothing recorded in
 * the future, and a screen that lets you walk into empty months is a screen
 * that makes you doubt the data.
 */
export function MonthNav({ month, current }: { month: string; current: string }) {
  const previous = shiftMonthKey(month, -1)
  const next = shiftMonthKey(month, 1)
  const canGoForward = next <= current

  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <Link
        href={`/finance?mese=${previous}`}
        aria-label={`Vai a ${formatMonthKey(previous)}`}
        className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </Link>

      <p className="font-heading text-lg">
        {formatMonthKey(month)}
        {month === current ? null : (
          <Link
            href="/finance"
            className="ml-3 align-middle text-xs font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            torna a questo mese
          </Link>
        )}
      </p>

      <Link
        href={canGoForward ? `/finance?mese=${next}` : '#'}
        aria-label={canGoForward ? `Vai a ${formatMonthKey(next)}` : 'Nessun mese successivo'}
        aria-disabled={!canGoForward}
        tabIndex={canGoForward ? undefined : -1}
        className={cn(
          'rounded p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          canGoForward
            ? 'text-muted-foreground hover:text-foreground'
            : 'pointer-events-none text-muted-foreground/30',
        )}
      >
        <ChevronRight className="size-5" aria-hidden />
      </Link>
    </div>
  )
}
