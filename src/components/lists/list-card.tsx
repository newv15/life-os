'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Archive, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { deleteListAction } from '@/app/(app)/lists/actions'
import type { ListSummary } from '@/lib/services/lists'

/**
 * One line per list, with the only number that matters: what is left.
 *
 * Not a progress bar. "4 da fare" answers the question you actually have while
 * deciding whether to open it; a bar answers how far along you are, which
 * nobody asks about a shopping list.
 */
export function ListCard({ list, active }: { list: ListSummary; active: boolean }) {
  const [pending, startTransition] = useTransition()
  const remaining = list.total - list.checked

  function remove() {
    startTransition(async () => {
      const result = await deleteListAction(list.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <li
      data-entity-id={list.id}
      className={cn(
        'group flex items-center gap-3 border-b border-rule py-3 last:border-b-0',
        pending && 'opacity-60',
      )}
    >
      <Link
        href={`/lists?lista=${list.id}`}
        aria-current={active ? 'true' : undefined}
        className="min-w-0 flex-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className={cn('text-sm', active && 'font-medium')}>{list.name}</span>

        <span className="data ml-3 text-xs text-muted-foreground">
          {list.total === 0
            ? 'vuota'
            : remaining === 0
              ? 'tutto fatto'
              : `${remaining} da fare`}
        </span>

        {list.keeps_history ? (
          <span
            className="ml-2 inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground"
            title="Le voci spuntate restano"
          >
            <Archive className="size-3" aria-hidden />
            storico
          </span>
        ) : null}
      </Link>

      <button
        type="button"
        onClick={remove}
        aria-label={`Elimina la lista ${list.name}`}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  )
}
