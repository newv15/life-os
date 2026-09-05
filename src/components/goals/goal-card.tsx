'use client'

import { useState, useTransition } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/progress-bar'
import { formatRelativeDay } from '@/lib/utils/date'
import { GOAL_HORIZON_LABELS, GOAL_STATUSES, GOAL_STATUS_LABELS } from '@/lib/validation/enums'
import { deleteGoalAction, updateGoalAction } from '@/app/(app)/goals/actions'
import type { GoalWithProgress } from '@/lib/services/goals'

/**
 * A goal, and the one action it actually needs: telling it where you are now.
 *
 * Recording progress is a single field that submits on enter, because it is
 * the thing done repeatedly - opening an edit dialog to change one number is
 * how a goal stops getting updated.
 */
export function GoalCard({
  goal,
  projectCount,
}: {
  goal: GoalWithProgress
  projectCount: number
}) {
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState('')

  function submitValue(event: React.FormEvent) {
    event.preventDefault()
    if (value.trim() === '') return

    startTransition(async () => {
      const result = await updateGoalAction(goal.id, { currentValue: value })
      if (result.ok) setValue('')
      else toast.error(result.issues?.currentValue ?? result.error)
    })
  }

  function setStatus(status: string) {
    startTransition(async () => {
      const result = await updateGoalAction(goal.id, { status })
      if (!result.ok) toast.error(result.error)
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteGoalAction(goal.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  const unit = goal.metric_unit ? ` ${goal.metric_unit}` : ''

  return (
    <li className={cn('group border-b border-rule py-4 last:border-b-0', pending && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{goal.title}</p>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{GOAL_HORIZON_LABELS[goal.horizon]}</span>
            {goal.target_value !== null ? (
              <span className="data">
                {Number(goal.current_value)} / {Number(goal.target_value)}
                {unit}
              </span>
            ) : null}
            {goal.deadline ? (
              <span className="data">
                entro {formatRelativeDay(`${goal.deadline}T12:00:00`)}
              </span>
            ) : null}
            {projectCount > 0 ? (
              <span>
                {projectCount} {projectCount === 1 ? 'progetto' : 'progetti'}
              </span>
            ) : null}
          </p>
        </div>

        <select
          aria-label={`Stato di ${goal.title}`}
          value={goal.status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {GOAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {GOAL_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={remove}
          aria-label={`Elimina ${goal.title}`}
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      {goal.progress !== null ? (
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar
            value={goal.progress}
            label={`Avanzamento di ${goal.title}`}
            className="flex-1"
          />
          <form onSubmit={submitValue} className="flex items-center gap-1">
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              inputMode="decimal"
              placeholder="Ora sono a…"
              aria-label={`Aggiorna il valore di ${goal.title}`}
              className="data h-7 w-28 text-xs"
            />
            <button
              type="submit"
              aria-label="Registra il valore"
              disabled={value.trim() === ''}
              className="rounded p-1 text-muted-foreground hover:text-primary disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Check className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      ) : null}
    </li>
  )
}
