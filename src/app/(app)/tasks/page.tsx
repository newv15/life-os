import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { TaskComposer } from '@/components/tasks/task-composer'
import { TaskRow } from '@/components/tasks/task-row'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { listTasks } from '@/lib/services/tasks'

export const metadata: Metadata = { title: 'Task · Life OS' }

export default async function TasksPage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  const [open, completed] = await Promise.all([
    listTasks(db, userId),
    listTasks(db, userId, { status: 'done', limit: 20 }),
  ])

  return (
    <>
      <PageHeader eyebrow="Attività" title="Task" />

      <TaskComposer />

      {open.length === 0 ? (
        <EmptyState
          title="Nessun task aperto."
          hint="Scrivi cosa devi fare qui sopra. La scadenza e la priorità sono facoltative: puoi aggiungerle dopo."
        />
      ) : (
        <ul>
          {open.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}

      {completed.length > 0 ? (
        <section aria-labelledby="completati" className="mt-10">
          <h2 id="completati" className="eyebrow mb-2">
            Completati
          </h2>
          <ul>
            {completed.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
