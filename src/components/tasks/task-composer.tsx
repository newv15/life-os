'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PRIORITIES, PRIORITY_LABELS } from '@/lib/validation/enums'
import { createTaskAction } from '@/app/(app)/tasks/actions'
import type { ActionResult } from '@/lib/actions/result'

/**
 * Adding a task should cost one line and one keystroke.
 *
 * Everything except the title is optional and sits to the right, so the common
 * case - type it, press enter - never touches them. The date field is a native
 * datetime-local on purpose: it emits "2026-09-05T10:00", a wall clock with no
 * zone, which is exactly what the validation layer reads as local time.
 */
export function TaskComposer() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createTaskAction,
    null,
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state) return
    if (state.ok) formRef.current?.reset()
    else toast.error(state.issues?.title ?? state.error)
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="mb-8">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="title"
          required
          maxLength={200}
          placeholder="Cosa devi fare?"
          aria-label="Titolo del task"
          className="flex-1"
        />
        <div className="flex gap-2">
          <Input
            type="datetime-local"
            name="dueAt"
            aria-label="Scadenza"
            className="w-full sm:w-52"
          />
          <select
            name="priority"
            aria-label="Priorità"
            defaultValue="medium"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
          <AddButton />
        </div>
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
