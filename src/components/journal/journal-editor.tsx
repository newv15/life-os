'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { saveJournalAction } from '@/app/(app)/journal/actions'
import type { ActionResult } from '@/lib/actions/result'
import type { JournalEntryRow } from '@/lib/services/personal'

/**
 * Today's page.
 *
 * Prefilled with whatever is already written, because a journal gets written
 * in passes - a line in the morning, the rest at night - and a form that
 * starts empty each time quietly discards the earlier pass.
 *
 * Energy and mood are optional and unlabelled beyond 1-5 on purpose: a scale
 * with definitions invites arguing with the definitions instead of answering.
 */
export function JournalEditor({
  date,
  entry,
}: {
  date: string
  entry: JournalEntryRow | null
}) {
  const [state, formAction] = useActionState<ActionResult<string> | null, FormData>(
    saveJournalAction,
    null,
  )

  useEffect(() => {
    if (!state) return
    if (state.ok) toast.success('Salvato.')
    else toast.error(state.issues ? Object.values(state.issues)[0] : state.error)
  }, [state])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="entryDate" value={date} />

      <Textarea
        name="body"
        rows={6}
        maxLength={20000}
        defaultValue={entry?.body ?? ''}
        placeholder="Com'è andata?"
        aria-label="Diario di oggi"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wins" className="eyebrow mb-1.5 block">
            Cosa è andato bene
          </label>
          <Textarea id="wins" name="wins" rows={2} defaultValue={entry?.wins ?? ''} />
        </div>
        <div>
          <label htmlFor="blockers" className="eyebrow mb-1.5 block">
            Cosa si è messo di traverso
          </label>
          <Textarea id="blockers" name="blockers" rows={2} defaultValue={entry?.blockers ?? ''} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Rating name="energy" label="Energia" value={entry?.energy ?? null} />
        <Rating name="mood" label="Umore" value={entry?.mood ?? null} />
        <SaveButton />
      </div>
    </form>
  )
}

function Rating({
  name,
  label,
  value,
}: {
  name: string
  label: string
  value: number | null
}) {
  return (
    <div>
      <label htmlFor={name} className="eyebrow mb-1.5 block">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type="number"
        min={1}
        max={5}
        defaultValue={value ?? ''}
        placeholder="1-5"
        className="data w-20"
      />
    </div>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="ml-auto" disabled={pending}>
      {pending ? 'Salvo…' : 'Salva'}
    </Button>
  )
}
