'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PRIORITIES, PRIORITY_LABELS } from '@/lib/validation/enums'
import { toDateTimeLocal } from '@/lib/utils/date'
import { updateTaskAction } from '@/app/(app)/tasks/actions'
import type { TaskRow } from '@/lib/db/repositories/tasks'

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

/**
 * Changing a task after the fact.
 *
 * A dialog rather than editing in place: there are four fields, and on a phone
 * a list row has no space for them. Until this existed the only way to fix a
 * deadline was to delete the task and type it again, which also threw away
 * when it was created and what it was linked to.
 *
 * The date field is pre-filled through toDateTimeLocal, not by slicing the
 * stored instant - otherwise opening the dialog and saving without touching
 * anything would quietly shift the deadline by the timezone offset.
 */
export function TaskEditor({
  task,
  projects,
  open,
  onOpenChange,
}: {
  task: TaskRow
  projects: { id: string; name: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState(task.title)
  const [dueAt, setDueAt] = useState(toDateTimeLocal(task.due_at))
  const [priority, setPriority] = useState(task.priority)
  const [projectId, setProjectId] = useState(task.project_id ?? '')

  function save() {
    startTransition(async () => {
      const result = await updateTaskAction(task.id, {
        title,
        // Blank clears the deadline: the convention everywhere in this system
        // is that an empty field means "not filled in", never zero.
        dueAt,
        priority,
        projectId,
      })

      if (!result.ok) {
        toast.error(result.issues ? Object.values(result.issues)[0] : result.error)
        return
      }

      // Asked for explicitly: revalidating the path marks the cache stale, but
      // the list on screen was rendered before the edit and nothing tells it to
      // read again. Without this the dialog closes over a row still showing the
      // old title - which reads exactly like a save that failed.
      router.refresh()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifica</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Cosa devi fare</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-due">Scadenza</Label>
            <Input
              id="task-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Lascia vuoto per togliere la scadenza.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-priority">Priorità</Label>
            <select
              id="task-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as typeof priority)}
              className={SELECT_CLASS}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          {projects.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="task-project">Progetto</Label>
              <select
                id="task-project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Nessun progetto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Annulla
          </Button>
          <Button onClick={save} disabled={pending || title.trim() === ''}>
            {pending ? 'Salvo…' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
