'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { WEEKDAY_LABELS } from '@/lib/validation/enums'
import { createHabitAction } from '@/app/(app)/habits/actions'
import type { ActionResult } from '@/lib/actions/result'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export function HabitComposer() {
  const [state, formAction] = useActionState<ActionResult<string> | null, FormData>(
    createHabitAction,
    null,
  )

  useEffect(() => {
    if (state && !state.ok) {
      toast.error(state.issues ? Object.values(state.issues)[0] : state.error)
    }
  }, [state])

  return <ComposerFields key={state?.ok ? state.data : 'initial'} action={formAction} />
}

function ComposerFields({ action }: { action: (formData: FormData) => void }) {
  const [weekly, setWeekly] = useState(false)

  return (
    <form action={action} className="mb-8 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="name"
          required
          maxLength={120}
          placeholder="Che abitudine vuoi tenere?"
          aria-label="Nome dell'abitudine"
          className="flex-1"
        />
        <div className="flex gap-2">
          <select
            name="frequency"
            aria-label="Frequenza"
            value={weekly ? 'weekly' : 'daily'}
            onChange={(event) => setWeekly(event.target.value === 'weekly')}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="daily">Ogni giorno</option>
            <option value="weekly">Giorni scelti</option>
          </select>
          <CreateButton />
        </div>
      </div>

      {weekly ? (
        <fieldset className="flex flex-wrap items-center gap-1">
          <legend className="sr-only">Giorni della settimana</legend>
          {WEEKDAYS.map((day) => (
            <label
              key={day}
              className="cursor-pointer text-xs [&:has(:checked)>span]:border-primary [&:has(:checked)>span]:bg-primary [&:has(:checked)>span]:text-primary-foreground"
            >
              <input type="checkbox" name="daysOfWeek" value={day} className="sr-only peer" />
              <span
                className={cn(
                  'inline-flex h-8 w-10 items-center justify-center rounded-md border border-input',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                )}
              >
                {WEEKDAY_LABELS[day]}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
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
