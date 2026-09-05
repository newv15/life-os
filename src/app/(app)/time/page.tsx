import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { TimeEntryList, TimerPanel } from '@/components/time/timer-panel'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { getRunningTimer, listTimeEntries, timeSummary } from '@/lib/services/personal'
import { listProjects } from '@/lib/services/projects'
import { formatDuration } from '@/lib/utils/duration'
import { daysAgo, startOfDayInTimeZone, todayISO } from '@/lib/utils/date'

export const metadata: Metadata = { title: 'Tempo · Life OS' }

export default async function TimePage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  const weekAgo = daysAgo(7).toISOString()

  const [running, entries, projects, week, today] = await Promise.all([
    getRunningTimer(db, userId),
    listTimeEntries(db, userId, { limit: 40 }),
    listProjects(db, userId),
    timeSummary(db, userId, weekAgo),
    timeSummary(db, userId, startOfDayInTimeZone(todayISO()).toISOString()),
  ])

  const projectName = new Map(projects.map((project) => [project.id, project.name]))

  return (
    <>
      <PageHeader eyebrow="Dove va il tempo" title="Tempo" />

      <TimerPanel running={running} projects={projects} />

      <section aria-labelledby="totali" className="mb-8">
        <h2 id="totali" className="eyebrow mb-2">
          Totali
        </h2>
        <dl className="flex gap-8">
          <div>
            <dt className="text-xs text-muted-foreground">Oggi</dt>
            <dd className="data mt-0.5 text-base">{formatDuration(today.totalSeconds)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ultimi 7 giorni</dt>
            <dd className="data mt-0.5 text-base">{formatDuration(week.totalSeconds)}</dd>
          </div>
        </dl>

        {week.byProject.length > 0 ? (
          <ul className="mt-4 space-y-1">
            {week.byProject.slice(0, 6).map((row) => (
              <li key={row.projectId ?? 'senza'} className="text-xs text-muted-foreground">
                {row.projectId ? projectName.get(row.projectId) : 'Senza progetto'}{' '}
                <span className="data text-foreground">{formatDuration(row.seconds)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {entries.length === 0 ? (
        <EmptyState
          title="Nessun tempo registrato."
          hint="Avvia il cronometro quando cominci qualcosa. Avviarne uno nuovo ferma il precedente, quindi non serve ricordarsi di chiuderlo."
        />
      ) : (
        <section aria-labelledby="voci">
          <h2 id="voci" className="eyebrow mb-2">
            Sessioni
          </h2>
          <TimeEntryList entries={entries} projects={projects} />
        </section>
      )}
    </>
  )
}
