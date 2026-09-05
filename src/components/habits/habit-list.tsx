'use client'

import { useOptimistic, useTransition } from 'react'
import { Check, Flame, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { WEEKDAY_LABELS } from '@/lib/validation/enums'
import { deleteHabitAction, recordHabitAction } from '@/app/(app)/habits/actions'
import type { HabitWithProgress } from '@/lib/services/habits'

export function HabitList({ habits }: { habits: HabitWithProgress[] }) {
  return (
    <ul>
      {habits.map((habit) => (
        <HabitRow key={habit.id} habit={habit} />
      ))}
    </ul>
  )
}

/**
 * One habit.
 *
 * The streak is the only number given any weight, because it is the one that
 * changes behaviour. Consistency over the month sits next to it in small type
 * as the honest counterweight - a streak of three says nothing about a habit
 * kept twice in thirty days.
 */
function HabitRow({ habit }: { habit: HabitWithProgress }) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useOptimistic(habit.doneToday)

  function toggle() {
    startTransition(async () => {
      setDone(!done)
      const result = await recordHabitAction(habit.id, !done)
      if (!result.ok) toast.error(result.error)
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteHabitAction(habit.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <li
      className={cn(
        'group flex items-start gap-3 border-b border-rule py-3 last:border-b-0',
        pending && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={done}
        aria-label={done ? `Annulla ${habit.name} per oggi` : `Segna ${habit.name} come fatta`}
        disabled={!habit.dueToday && !done}
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          done
            ? 'border-positive bg-positive text-background'
            : habit.dueToday
              ? 'border-muted-foreground/50 hover:border-primary'
              : 'border-rule text-muted-foreground/40',
        )}
      >
        {done ? <Check className="size-3.5" aria-hidden /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{habit.name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {habit.streak > 0 ? (
            <span className="inline-flex items-center gap-1 text-signal">
              <Flame className="size-3" aria-hidden />
              <span className="data">{habit.streak}</span>
              {habit.streak === 1 ? 'giorno' : 'giorni'} di fila
            </span>
          ) : (
            <span>Nessuna serie in corso</span>
          )}
          <span className="data">{habit.consistency}% negli ultimi 30 giorni</span>
          {habit.frequency === 'weekly' ? (
            <span>{(habit.days_of_week ?? []).map((d) => WEEKDAY_LABELS[d]).join(' ')}</span>
          ) : null}
          {!habit.dueToday ? <span>oggi non tocca</span> : null}
        </p>
      </div>

      <button
        type="button"
        onClick={remove}
        aria-label={`Elimina ${habit.name}`}
        className="mt-0.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  )
}
