'use client'

import { useActionState, useEffect, useOptimistic, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addItemAction,
  clearCheckedAction,
  toggleItemAction,
} from '@/app/(app)/lists/actions'
import type { ActionResult } from '@/lib/actions/result'
import type { ListItemRow, ListRow } from '@/lib/services/lists'

/**
 * One list, open.
 *
 * The field to add sits at the top because adding is what you do standing up,
 * with one hand, in a shop - and it keeps focus after each line, so three
 * things are three keystrokes and not three round trips through the page.
 */
export function ListItems({ list, items }: { list: ListRow; items: ListItemRow[] }) {
  const open = items.filter((item) => item.checked_at === null)
  const done = items.filter((item) => item.checked_at !== null)

  return (
    <div>
      <AddItem listName={list.name} />

      {items.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Lista vuota. Scrivi qui sopra, oppure dillo al bot: «aggiungi il latte a {list.name}».
        </p>
      ) : (
        <ul>
          {open.map((item) => (
            <Item key={item.id} item={item} />
          ))}
        </ul>
      )}

      {done.length > 0 ? (
        <section aria-labelledby="fatte" className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="fatte" className="eyebrow">
              Fatte
            </h2>

            {/* Solo sulle liste che si svuotano: dove lo storico è il
                contenuto, questo pulsante cancellerebbe la lista stessa. */}
            {list.keeps_history ? null : <ClearChecked listId={list.id} count={done.length} />}
          </div>

          <ul>
            {done.map((item) => (
              <Item key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function AddItem({ listName }: { listName: string }) {
  const action = addItemAction.bind(null, listName)
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null)

  useEffect(() => {
    if (state && !state.ok) {
      toast.error(state.issues ? Object.values(state.issues)[0] : state.error)
    }
  }, [state])

  return (
    <form
      key={state?.ok ? 'done' : 'initial'}
      action={formAction}
      className="mb-4 flex items-center gap-2"
    >
      <Input
        name="text"
        required
        autoFocus
        autoComplete="off"
        maxLength={200}
        placeholder="Aggiungi una voce"
        aria-label={`Aggiungi una voce a ${listName}`}
        className="min-w-0 flex-1"
      />
      <AddButton />
    </form>
  )
}

function AddButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? '…' : 'Aggiungi'}
    </Button>
  )
}

function Item({ item }: { item: ListItemRow }) {
  const [pending, startTransition] = useTransition()
  const [checked, setChecked] = useOptimistic(item.checked_at !== null)

  function toggle() {
    startTransition(async () => {
      setChecked(!checked)
      const result = await toggleItemAction(item.id, !checked)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <li
      data-entity-id={item.id}
      className={cn(
        'flex items-center gap-3 border-b border-rule py-2.5 last:border-b-0',
        pending && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={checked}
        aria-label={checked ? `Riapri ${item.text}` : `Spunta ${item.text}`}
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          checked
            ? 'border-positive bg-positive text-background'
            : 'border-muted-foreground/50 hover:border-primary',
        )}
      >
        {checked ? <span aria-hidden>✓</span> : null}
      </button>

      <span className={cn('min-w-0 flex-1 text-sm', checked && 'text-muted-foreground line-through')}>
        {item.text}
      </span>
    </li>
  )
}

function ClearChecked({ listId, count }: { listId: string; count: number }) {
  const [pending, startTransition] = useTransition()

  function clear() {
    startTransition(async () => {
      const result = await clearCheckedAction(listId)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <button
      type="button"
      onClick={clear}
      disabled={pending}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Trash2 className="size-3.5" aria-hidden />
      {count === 1 ? 'Svuota 1 voce spuntata' : `Svuota ${count} voci spuntate`}
    </button>
  )
}
