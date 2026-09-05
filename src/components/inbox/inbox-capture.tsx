'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { captureInboxAction } from '@/app/(app)/inbox/actions'
import type { ActionResult } from '@/lib/actions/result'

/**
 * Capture, and nothing else.
 *
 * A textarea rather than a single line, because what lands here is a thought
 * rather than a title, and it arrives at whatever length it arrives. Enter
 * sends it; shift+enter keeps writing - the thing being optimised is getting
 * it out of your head, not formatting it.
 */
export function InboxCapture() {
  const [state, formAction] = useActionState<ActionResult<string> | null, FormData>(
    captureInboxAction,
    null,
  )

  useEffect(() => {
    if (state && !state.ok) {
      toast.error(state.issues ? Object.values(state.issues)[0] : state.error)
    }
  }, [state])

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <form key={state?.ok ? state.data : 'initial'} action={formAction} className="mb-8 space-y-2">
      <Textarea
        name="rawText"
        required
        rows={2}
        maxLength={10000}
        onKeyDown={handleKeyDown}
        placeholder="Cosa ti è venuto in mente?"
        aria-label="Nuovo appunto"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Invio per salvare, maiusc+invio per andare a capo.
        </p>
        <SaveButton />
      </div>
    </form>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Salvo…' : 'Salva'}
    </Button>
  )
}
