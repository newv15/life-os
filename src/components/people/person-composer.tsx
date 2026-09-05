'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createPersonAction } from '@/app/(app)/people/actions'
import type { ActionResult } from '@/lib/actions/result'

export function PersonComposer() {
  const [state, formAction] = useActionState<ActionResult<string> | null, FormData>(
    createPersonAction,
    null,
  )

  useEffect(() => {
    if (state && !state.ok) {
      toast.error(state.issues ? Object.values(state.issues)[0] : state.error)
    }
  }, [state])

  return (
    <form
      key={state?.ok ? state.data : 'initial'}
      action={formAction}
      className="mb-8 flex flex-col gap-2 sm:flex-row"
    >
      <Input
        name="fullName"
        required
        maxLength={150}
        placeholder="Nome"
        aria-label="Nome"
        className="flex-1"
      />
      <div className="flex gap-2">
        <Input
          name="relationship"
          maxLength={120}
          placeholder="Chi è"
          aria-label="Relazione"
          className="w-full sm:w-44"
        />
        <Input
          name="phone"
          maxLength={120}
          placeholder="Telefono"
          aria-label="Telefono"
          className="w-full sm:w-40"
        />
        <AddButton />
      </div>
    </form>
  )
}

function AddButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Aggiungo…' : 'Aggiungi'}
    </Button>
  )
}
