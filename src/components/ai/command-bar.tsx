'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { CornerDownLeft, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { askAIAction, confirmAIAction } from '@/app/(app)/ai-actions'
import type { ActionResult } from '@/lib/actions/result'
import type { AIRunResult } from '@/lib/ai/service'

/**
 * One line, above everything, on every screen.
 *
 * This is the promise the whole system is built around: you say what happened
 * and it gets filed. It sits in the layout rather than on the dashboard so it
 * is never more than a glance away - the moment you have to navigate somewhere
 * to record a thought is the moment you stop recording thoughts.
 *
 * The reply stays on screen until dismissed. What the assistant did has to be
 * readable and checkable, not a toast that vanishes before it is read.
 */
export function CommandBar() {
  const [state, formAction] = useActionState<ActionResult<AIRunResult> | null, FormData>(
    askAIAction,
    null,
  )

  const result = state?.ok ? state.data : null

  return (
    <div className="mb-7">
      <form
        key={result?.conversationId ?? 'initial'}
        action={formAction}
        className="flex items-center gap-2 rounded-lg border border-rule bg-card px-3 py-2 focus-within:border-primary"
      >
        <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          name="message"
          required
          autoComplete="off"
          placeholder="Cosa vuoi fare?"
          aria-label="Chiedi o registra qualcosa"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <SendHint />
      </form>

      {state && !state.ok ? (
        <Reply tone="error" text={state.error} />
      ) : result ? (
        <Reply
          tone="normal"
          text={result.reply}
          confirmation={result.pendingConfirmation}
          executed={result.executedTools}
        />
      ) : null}
    </div>
  )
}

function SendHint() {
  const { pending } = useFormStatus()

  return pending ? (
    <span className="shrink-0 text-xs text-muted-foreground">Ci penso…</span>
  ) : (
    <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  )
}

function Reply({
  text,
  tone,
  confirmation,
  executed = [],
}: {
  text: string
  tone: 'normal' | 'error'
  confirmation?: { id: string; question: string }
  executed?: string[]
}) {
  const [dismissed, setDismissed] = useState(false)
  const [resolved, setResolved] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (dismissed) return null

  function answer(confirmed: boolean) {
    if (!confirmation) return

    startTransition(async () => {
      const outcome = await confirmAIAction(confirmation.id, confirmed)
      if (outcome.ok) setResolved(outcome.data.reply)
      else toast.error(outcome.error)
    })
  }

  return (
    <div
      className={cn(
        'mt-2 flex items-start gap-3 border-l-2 pl-4 text-sm',
        tone === 'error' ? 'border-destructive text-destructive' : 'border-primary',
      )}
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="leading-relaxed">{resolved ?? text}</p>

        {confirmation && !resolved ? (
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => answer(true)} disabled={pending}>
              Sì, procedi
            </Button>
            <Button size="sm" variant="ghost" onClick={() => answer(false)} disabled={pending}>
              No, lascia stare
            </Button>
          </div>
        ) : null}

        {executed.length > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {executed.length === 1 ? 'Azione eseguita' : `${executed.length} azioni eseguite`}:{' '}
            {executed.join(', ')}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Chiudi la risposta"
        className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
