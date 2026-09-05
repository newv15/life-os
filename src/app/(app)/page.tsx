import type { Metadata } from 'next'
import Link from 'next/link'
import { DaySpine, type SpineItem } from '@/components/dashboard/day-spine'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { TaskRow } from '@/components/tasks/task-row'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { getFinancialSummary, listAccounts } from '@/lib/services/finance'
import { listGoals } from '@/lib/services/goals'
import { listInboxItems } from '@/lib/services/inbox'
import { listProjects } from '@/lib/services/projects'
import { listTasks } from '@/lib/services/tasks'
import { formatEUR } from '@/lib/utils/currency'
import {
  endOfDayInTimeZone,
  formatLongDate,
  isOverdue,
  monthRange,
  todayISO,
} from '@/lib/utils/date'

export const metadata: Metadata = { title: 'Oggi · Life OS' }

export default async function TodayPage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  const today = todayISO()
  const endOfToday = endOfDayInTimeZone(today).toISOString()
  const range = monthRange()

  const [dueToday, allOpen, accounts, summary, inbox, projects, goals] = await Promise.all([
    // Everything still open that was due before tonight: today's work plus
    // whatever slipped from before it.
    listTasks(db, userId, { dueBefore: endOfToday }),
    listTasks(db, userId),
    listAccounts(db, userId),
    getFinancialSummary(db, userId, range),
    listInboxItems(db, userId),
    listProjects(db, userId),
    listGoals(db, userId),
  ])

  const projectName = new Map(projects.map((project) => [project.id, project.name]))
  const balance = accounts.reduce((sum, account) => sum + Number(account.current_balance), 0)

  // The spine is the shape of the day, so only things with a time belong on
  // it. A task due "today" with no hour is work to fit in, not an appointment.
  const spineItems: SpineItem[] = dueToday
    .filter((task) => task.due_at && task.due_at >= `${today}T00:00:00`)
    .map((task) => ({
      id: task.id,
      at: task.due_at!,
      title: task.title,
      detail: task.project_id ? projectName.get(task.project_id) : undefined,
      now: isOverdue(task.due_at),
    }))

  return (
    <>
      <PageHeader eyebrow={formatLongDate()} title="Oggi" />

      <section aria-labelledby="agenda" className="mb-10">
        <h2 id="agenda" className="eyebrow mb-3">
          Agenda
        </h2>
        <DaySpine items={spineItems} />
      </section>

      <section aria-labelledby="da-fare" className="mb-10">
        <h2 id="da-fare" className="eyebrow mb-3">
          Da fare
        </h2>
        {dueToday.length === 0 ? (
          <EmptyState
            title={
              allOpen.length === 0 ? 'Niente in lista.' : 'Niente in scadenza oggi.'
            }
            hint={
              allOpen.length === 0
                ? 'Aggiungi il primo task da Task, oppure buttalo in Inbox se non hai ancora deciso cosa sia.'
                : `Hai ${allOpen.length} ${allOpen.length === 1 ? 'task aperto' : 'task aperti'} senza scadenza per oggi.`
            }
          />
        ) : (
          <ul>
            {dueToday.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                projectName={task.project_id ? projectName.get(task.project_id) : null}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="colpo-docchio">
        <h2 id="colpo-docchio" className="eyebrow mb-3">
          A colpo d&apos;occhio
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Glance label="Saldo" value={formatEUR(balance)} href="/finance" />
          <Glance
            label="Uscite del mese"
            value={formatEUR(summary.expense)}
            href="/finance"
          />
          <Glance
            label="In inbox"
            value={String(inbox.length)}
            href="/inbox"
            muted={inbox.length === 0}
          />
          <Glance
            label="Obiettivi attivi"
            value={String(goals.length)}
            href="/goals"
            muted={goals.length === 0}
          />
        </dl>
      </section>
    </>
  )
}

function Glance({
  label,
  value,
  href,
  muted = false,
}: {
  label: string
  value: string
  href: string
  muted?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">
        <Link
          href={href}
          className={`data text-lg hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            muted ? 'text-muted-foreground' : ''
          }`}
        >
          {value}
        </Link>
      </dd>
    </div>
  )
}
