'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createEventAction } from '@/app/(app)/calendar/actions'
import type { ActionResult } from '@/lib/actions/result'

export function EventComposer() {
  const [state, formAction] = useActionState<ActionResult<string> | null, FormData>(
    createEventAction,
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
          placeholder="Che impegno è?"
          aria-label="Titolo"
          className="flex-1"
        />
        <div className="flex gap-2">
          <Input
            type="datetime-local"
            name="startsAt"
            required
            aria-label="Inizio"
            className="w-full sm:w-52"
          />
          <SaveButton />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input type="datetime-local" name="endsAt" aria-label="Fine (facoltativa)" className="w-52" />
        <Input name="location" maxLength={200} placeholder="Dove" aria-label="Luogo" className="w-44" />
      </div>
    </form>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Aggiungo…' : 'Aggiungi'}
    </Button>
  )
}
