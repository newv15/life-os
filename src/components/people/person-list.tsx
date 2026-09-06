'use client'

import { useState, useTransition } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { formatRelativeDay, isOverdue } from '@/lib/utils/date'
import { deletePersonAction, updatePersonAction } from '@/app/(app)/people/actions'
import type { PersonRow } from '@/lib/services/personal'

export function PersonList({ people }: { people: PersonRow[] }) {
  return (
    <ul>
      {people.map((person) => (
        <PersonRowItem key={person.id} person={person} />
      ))}
    </ul>
  )
}

/**
 * A contact, and the one field that makes an address book useful.
 *
 * "Next action" is the difference between a list of names and something that
 * reminds you to call your accountant. It is editable in place, because that
 * is the note you scribble the moment you hang up.
 */
function PersonRowItem({ person }: { person: PersonRow }) {
  const [pending, startTransition] = useTransition()
  const [action, setAction] = useState(person.next_action ?? '')

  function saveAction(event: React.FormEvent) {
    event.preventDefault()

    startTransition(async () => {
      const result = await updatePersonAction(person.id, { nextAction: action })
      if (result.ok) toast.success('Aggiornato.')
      else toast.error(result.error)
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deletePersonAction(person.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  const late = isOverdue(person.next_action_at)

  return (
    <li
      data-entity-id={person.id}
      className={cn(
        'group border-b border-rule py-3 last:border-b-0',
        pending && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">{person.full_name}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {person.relationship ? <span>{person.relationship}</span> : null}
            {person.company ? <span>{person.company}</span> : null}
            {person.phone ? <span className="data">{person.phone}</span> : null}
            {person.next_action_at ? (
              <span className={cn('data', late && 'text-destructive')}>
                {late ? 'da fare ' : ''}
                {formatRelativeDay(person.next_action_at)}
              </span>
            ) : null}
          </p>
        </div>

        <button
          type="button"
          onClick={remove}
          aria-label={`Elimina ${person.full_name}`}
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      <form onSubmit={saveAction} className="mt-2 flex items-center gap-1">
        <Input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="Prossima cosa da fare con questa persona"
          aria-label={`Prossima azione per ${person.full_name}`}
          className="h-8 text-xs"
        />
        <button
          type="submit"
          aria-label="Salva la prossima azione"
          disabled={action === (person.next_action ?? '')}
          className="rounded p-1 text-muted-foreground hover:text-primary disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Check className="size-4" aria-hidden />
        </button>
      </form>
    </li>
  )
}
