import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectComposer } from '@/components/projects/project-composer'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { listGoals } from '@/lib/services/goals'
import { listProjects } from '@/lib/services/projects'

export const metadata: Metadata = { title: 'Progetti · Life OS' }

export default async function ProjectsPage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  const [projects, goals] = await Promise.all([
    listProjects(db, userId, 'all'),
    listGoals(db, userId),
  ])

  const goalTitle = new Map(goals.map((goal) => [goal.id, goal.title]))
  const open = projects.filter((p) => p.status !== 'done' && p.status !== 'archived')
  const closed = projects.filter((p) => p.status === 'done' || p.status === 'archived')

  return (
    <>
      <PageHeader eyebrow="In corso" title="Progetti" />

      <ProjectComposer goals={goals} />

      {open.length === 0 ? (
        <EmptyState
          title="Nessun progetto attivo."
          hint="Un progetto raccoglie i task che servono allo stesso risultato. Aggancialo a un obiettivo e saprai sempre a cosa stai lavorando davvero."
        />
      ) : (
        <ul>
          {open.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              goalTitle={project.goal_id ? goalTitle.get(project.goal_id) : null}
            />
          ))}
        </ul>
      )}

      {closed.length > 0 ? (
        <section aria-labelledby="conclusi" className="mt-10">
          <h2 id="conclusi" className="eyebrow mb-2">
            Conclusi
          </h2>
          <ul>
            {closed.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                goalTitle={project.goal_id ? goalTitle.get(project.goal_id) : null}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
