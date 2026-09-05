'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ProgressBar } from '@/components/ui/progress-bar'
import { formatRelativeDay } from '@/lib/utils/date'
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '@/lib/validation/enums'
import { deleteProjectAction, updateProjectAction } from '@/app/(app)/projects/actions'
import type { ProjectWithProgress } from '@/lib/services/projects'

export function ProjectCard({
  project,
  goalTitle,
}: {
  project: ProjectWithProgress
  goalTitle?: string | null
}) {
  const [pending, startTransition] = useTransition()

  function setStatus(status: string) {
    startTransition(async () => {
      const result = await updateProjectAction(project.id, { status })
      if (!result.ok) toast.error(result.error)
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteProjectAction(project.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <li
      className={cn(
        'group border-b border-rule py-4 last:border-b-0',
        pending && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{project.name}</p>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {project.doneCount}/{project.taskCount}{' '}
              {project.taskCount === 1 ? 'task' : 'task'}
            </span>
            {project.deadline ? (
              <span className="data">
                entro {formatRelativeDay(`${project.deadline}T12:00:00`)}
              </span>
            ) : null}
            {goalTitle ? <span>→ {goalTitle}</span> : null}
          </p>
        </div>

        <select
          aria-label={`Stato di ${project.name}`}
          value={project.status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {PROJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PROJECT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={remove}
          aria-label={`Elimina ${project.name}`}
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      {project.taskCount > 0 ? (
        <ProgressBar
          value={project.progress}
          label={`Avanzamento di ${project.name}`}
          className="mt-3"
        />
      ) : null}
    </li>
  )
}
