'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createProjectAction } from '@/app/(app)/projects/actions'
import type { ActionResult } from '@/lib/actions/result'
import type { GoalWithProgress } from '@/lib/services/goals'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

export function ProjectComposer({ goals }: { goals: GoalWithProgress[] }) {
  const [state, formAction] = useActionState<ActionResult<string> | null, FormData>(
    createProjectAction,
    null,
  )

  useEffect(() => {
    if (state && !state.ok) {
      toast.error(state.issues ? Object.values(state.issues)[0] : state.error)
    }
  }, [state])

  return (
    <form key={state?.ok ? state.data : 'initial'} action={formAction} className="mb-8">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="name"
          required
          maxLength={120}
          placeholder="Nome del progetto"
          aria-label="Nome del progetto"
          className="flex-1"
        />
        <div className="flex flex-wrap gap-2">
          {goals.length > 0 ? (
            <select name="goalId" aria-label="Obiettivo" defaultValue="" className={SELECT_CLASS}>
              <option value="">Nessun obiettivo</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          ) : null}
          <Input type="date" name="deadline" aria-label="Scadenza" className="w-auto" />
          <CreateButton />
        </div>
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
