'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GOAL_HORIZONS, GOAL_HORIZON_LABELS } from '@/lib/validation/enums'
import { createGoalAction } from '@/app/(app)/goals/actions'
import type { ActionResult } from '@/lib/actions/result'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

/**
 * Setting a goal.
 *
 * The numbers are optional because half of what people aim at has none.
 * "Leggere di più" is a goal; forcing it to carry a target would turn it into
 * a spreadsheet row nobody updates.
 */
export function GoalComposer() {
  const [state, formAction] = useActionState<ActionResult<string> | null, FormData>(
    createGoalAction,
    null,
  )

  useEffect(() => {
    if (state && !state.ok) {
      toast.error(state.issues ? Object.values(state.issues)[0] : state.error)
    }
  }, [state])

  return (
    <form key={state?.ok ? state.data : 'initial'} action={formAction} className="mb-8 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="title"
          required
          maxLength={200}
          placeholder="Cosa vuoi raggiungere?"
          aria-label="Obiettivo"
          className="flex-1"
        />
        <div className="flex gap-2">
          <select
            name="horizon"
            aria-label="Orizzonte"
            defaultValue="yearly"
            className={SELECT_CLASS}
          >
            {GOAL_HORIZONS.map((horizon) => (
              <option key={horizon} value={horizon}>
                {GOAL_HORIZON_LABELS[horizon]}
              </option>
            ))}
          </select>
          <CreateButton />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          name="currentValue"
          inputMode="decimal"
          placeholder="Da"
          aria-label="Valore di partenza"
          className="data w-24"
        />
        <Input
          name="targetValue"
          inputMode="decimal"
          placeholder="A"
          aria-label="Valore da raggiungere"
          className="data w-24"
        />
        <Input
          name="metricUnit"
          maxLength={30}
          placeholder="EUR, kg, libri…"
          aria-label="Unità di misura"
          className="w-36"
        />
        <Input type="date" name="deadline" aria-label="Entro quando" className="w-auto" />
      </div>
    </form>
  )
}

function CreateButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creo…' : 'Crea'}
    </Button>
  )
}
