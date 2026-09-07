'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { createListAction } from '@/app/(app)/lists/actions'
import type { ActionResult } from '@/lib/actions/result'

/**
 * A new list is a name and one decision.
 *
 * The decision is on screen rather than in a settings panel because it changes
 * what the list is for, and it is easier to get right while thinking about the
 * list than to find later: the shopping one empties itself, the films one is
 * the record of what you watched.
 */
export function ListComposer() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createListAction, null)

  useEffect(() => {
    if (state && !state.ok) {
      toast.error(state.issues ? Object.values(state.issues)[0] : state.error)
    }
  }, [state])

  return (
    <form
      key={state?.ok ? 'done' : 'initial'}
      action={formAction}
      className="mb-8 flex flex-wrap items-center gap-3"
    >
      <Input
        name="name"
        required
        maxLength={80}
        placeholder="Nuova lista — spesa, valigia, film da vedere"
        aria-label="Nome della nuova lista"
        className="min-w-0 flex-1"
      />

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox name="keepsHistory" />
        Tiene lo storico
      </label>

      <CreateButton />
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
