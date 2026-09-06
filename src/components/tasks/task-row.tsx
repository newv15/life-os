'use client'

import { useOptimistic, useTransition } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatRelativeDay, formatTime, isOverdue } from '@/lib/utils/date'
import { PRIORITY_LABELS } from '@/lib/validation/enums'
import { deleteTaskAction, setTaskDoneAction } from '@/app/(app)/tasks/actions'
import type { TaskRow as Task } from '@/lib/db/repositories/tasks'

export type TaskRowProps = {
  task: Task
  projectName?: string | null
}

/**
 * One line of the list.
 *
 * Only two things earn colour here: a deadline that has passed, and one that
 * lands today. Priority is written as a word and only when it is high or
 * urgent - if everything were coloured, nothing would read as urgent.
 */
export function TaskRow({ task, projectName }: TaskRowProps) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useOptimistic(task.status === 'done')

  function toggle() {
    startTransition(async () => {
      setDone(!done)
      const result = await setTaskDoneAction(task.id, !done)
      if (!result.ok) toast.error(result.error)
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteTaskAction(task.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <li
      data-entity-id={task.id}
      className={cn(
        'group flex items-start gap-3 border-b border-rule py-3 last:border-b-0',
        pending && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={done}
        aria-label={done ? `Riapri ${task.title}` : `Completa ${task.title}`}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          done
            ? 'border-positive bg-positive text-background'
            : 'border-muted-foreground/50 hover:border-primary',
        )}
      >
        {done ? <Check className="size-3.5" aria-hidden /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug', done && 'text-muted-foreground line-through')}>
          {task.title}
        </p>

        <TaskMeta task={task} projectName={projectName} done={done} />
      </div>

      <button
        type="button"
        onClick={remove}
        aria-label={`Elimina ${task.title}`}
        className="mt-0.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  )
}

function TaskMeta({
  task,
  projectName,
  done,
}: {
  task: Task
  projectName?: string | null
  done: boolean
}) {
  const parts: React.ReactNode[] = []

  if (task.due_at) {
    const late = !done && isOverdue(task.due_at)
    const day = formatRelativeDay(task.due_at)
    const time = formatTime(task.due_at)

    parts.push(
      <span
        key="due"
        className={cn(
          'data',
          late ? 'text-destructive' : day === 'oggi' ? 'text-signal' : 'text-muted-foreground',
        )}
      >
        {late ? 'scaduto ' : ''}
        {day} {time}
      </span>,
    )
  }

  if (task.priority === 'high' || task.priority === 'urgent') {
    parts.push(
      <span key="priority" className="uppercase tracking-wide">
        {PRIORITY_LABELS[task.priority]}
      </span>,
    )
  }

  if (projectName) parts.push(<span key="project">{projectName}</span>)

  if (parts.length === 0) return null

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {parts}
    </p>
  )
}
