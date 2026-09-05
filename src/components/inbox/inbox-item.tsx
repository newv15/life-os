'use client'

import { useState, useTransition } from 'react'
import { CheckSquare, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatRelativeDay } from '@/lib/utils/date'
import { dismissInboxAction, promoteToTaskAction } from '@/app/(app)/inbox/actions'
import type { InboxItemRow } from '@/lib/services/inbox'

const SOURCE_LABELS: Record<string, string> = {
  web: 'dal web',
  telegram: 'da Telegram',
  ai: "dall'AI",
  system: 'dal sistema',
}

/**
 * Sorting one captured thought.
 *
 * Turning it into a task opens the text for editing first, prefilled with what
 * was written. What gets captured in a hurry is rarely what belongs on a task
 * list, and the moment of sorting is the right moment to tidy it - later means
 * never.
 */
export function InboxItem({ item }: { item: InboxItemRow }) {
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.raw_text)
  const [dueAt, setDueAt] = useState('')

  function promote(event: React.FormEvent) {
    event.preventDefault()

    startTransition(async () => {
      const result = await promoteToTaskAction(item.id, { title, dueAt })
      if (!result.ok) toast.error(result.issues?.title ?? result.error)
    })
  }

  function dismiss() {
    startTransition(async () => {
      const result = await dismissInboxAction(item.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <li className={cn('group border-b border-rule py-3 last:border-b-0', pending && 'opacity-60')}>
      {editing ? (
        <form onSubmit={promote} className="space-y-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            autoFocus
            aria-label="Titolo del task"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              aria-label="Scadenza"
              className="w-52"
            />
            <Button type="submit" size="sm" disabled={pending}>
              Crea task
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Annulla
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug whitespace-pre-wrap">{item.raw_text}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="data">{formatRelativeDay(item.created_at)}</span>{' '}
              {SOURCE_LABELS[item.source] ?? ''}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Trasforma in task"
              className="rounded p-1 text-muted-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <CheckSquare className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Ignora questo appunto"
              className="rounded p-1 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
