'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { Play, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDuration, secondsBetween } from '@/lib/utils/duration'
import { formatRelativeDay, formatTime } from '@/lib/utils/date'
import {
  deleteTimeEntryAction,
  startTimerAction,
  stopTimerAction,
} from '@/app/(app)/time/actions'
import type { ActionResult } from '@/lib/actions/result'
import type { ProjectWithProgress } from '@/lib/services/projects'
import type { TimeEntryRow } from '@/lib/services/personal'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

/**
 * The running clock.
 *
 * It ticks on screen because a timer you cannot see running is a timer you
 * forget to stop, and hours of "work" recorded overnight are worse than no
 * record at all.
 */
export function TimerPanel({
  running,
  projects,
}: {
  running: TimeEntryRow | null
  projects: ProjectWithProgress[]
}) {
  return running ? (
    <RunningTimer entry={running} projects={projects} />
  ) : (
    <StartForm projects={projects} />
  )
}

function RunningTimer({
  entry,
  projects,
}: {
  entry: TimeEntryRow
  projects: ProjectWithProgress[]
}) {
  const [elapsed, setElapsed] = useState(() => secondsBetween(entry.started_at, null))
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const id = setInterval(() => setElapsed(secondsBetween(entry.started_at, null)), 1000)
    return () => clearInterval(id)
  }, [entry.started_at])

  const projectName = projects.find((project) => project.id === entry.project_id)?.name

  function stop() {
    startTransition(async () => {
      const result = await stopTimerAction()
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <div
      className={cn(
        'mb-8 flex items-center gap-4 border-l-2 border-signal pl-4',
        pending && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="data text-2xl leading-none">{formatDuration(elapsed)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {entry.note || 'In corso'}
          {projectName ? ` · ${projectName}` : ''} · dalle{' '}
          <span className="data">{formatTime(entry.started_at)}</span>
        </p>
      </div>

      <Button onClick={stop} disabled={pending} variant="secondary">
        <Square className="size-4" aria-hidden />
        Ferma
      </Button>
    </div>
  )
}

function StartForm({ projects }: { projects: ProjectWithProgress[] }) {
  const [state, formAction] = useActionState<ActionResult<string> | null, FormData>(
    startTimerAction,
    null,
  )

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error)
  }, [state])

  return (
    <form
      key={state?.ok ? state.data : 'initial'}
      action={formAction}
      className="mb-8 flex flex-col gap-2 sm:flex-row"
    >
      <Input
        name="note"
        maxLength={120}
        placeholder="A cosa stai lavorando?"
        aria-label="Su cosa stai lavorando"
        className="flex-1"
      />
      <div className="flex gap-2">
        {projects.length > 0 ? (
          <select name="projectId" aria-label="Progetto" defaultValue="" className={SELECT_CLASS}>
            <option value="">Nessun progetto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        ) : null}
        <StartButton />
      </div>
    </form>
  )
}

function StartButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      <Play className="size-4" aria-hidden />
      {pending ? 'Avvio…' : 'Avvia'}
    </Button>
  )
}

export function TimeEntryList({
  entries,
  projects,
}: {
  entries: TimeEntryRow[]
  projects: ProjectWithProgress[]
}) {
  const projectName = new Map(projects.map((project) => [project.id, project.name]))

  return (
    <ul>
      {entries.map((entry) => (
        <TimeEntryRowItem
          key={entry.id}
          entry={entry}
          projectName={entry.project_id ? projectName.get(entry.project_id) : undefined}
        />
      ))}
    </ul>
  )
}

function TimeEntryRowItem({
  entry,
  projectName,
}: {
  entry: TimeEntryRow
  projectName?: string
}) {
  const [pending, startTransition] = useTransition()

  function remove() {
    startTransition(async () => {
      const result = await deleteTimeEntryAction(entry.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <li
      className={cn(
        'group flex items-baseline gap-3 border-b border-rule py-3 last:border-b-0',
        pending && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-snug">{entry.note || 'Senza descrizione'}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="data">
            {formatRelativeDay(entry.started_at)} {formatTime(entry.started_at)}
          </span>
          {projectName ? ` · ${projectName}` : ''}
        </p>
      </div>

      <span className="data shrink-0 text-sm">
        {entry.ended_at ? formatDuration(secondsBetween(entry.started_at, entry.ended_at)) : '—'}
      </span>

      <button
        type="button"
        onClick={remove}
        aria-label="Elimina questa voce"
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  )
}
