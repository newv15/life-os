import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { GoalCard } from '@/components/goals/goal-card'
import { GoalComposer } from '@/components/goals/goal-composer'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { listGoals } from '@/lib/services/goals'
import { listProjects } from '@/lib/services/projects'

export const metadata: Metadata = { title: 'Obiettivi · Life OS' }

export default async function GoalsPage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  const [goals, projects] = await Promise.all([
    listGoals(db, userId, 'all'),
    listProjects(db, userId, 'all'),
  ])

  const projectsPerGoal = new Map<string, number>()
  for (const project of projects) {
    if (!project.goal_id) continue
    projectsPerGoal.set(project.goal_id, (projectsPerGoal.get(project.goal_id) ?? 0) + 1)
  }

  const open = goals.filter((g) => g.status === 'active' || g.status === 'paused')
  const closed = goals.filter((g) => g.status === 'done' || g.status === 'abandoned')

  return (
    <>
      <PageHeader eyebrow="Dove stai andando" title="Obiettivi" />

      <GoalComposer />

      {open.length === 0 ? (
        <EmptyState
          title="Nessun obiettivo in corso."
          hint="Gli obiettivi stanno sopra progetti e task: sono quelli che rendono rispondibile la domanda «tutto questo a cosa serve?». I numeri sono facoltativi."
        />
      ) : (
        <ul>
          {open.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              projectCount={projectsPerGoal.get(goal.id) ?? 0}
            />
          ))}
        </ul>
      )}

      {closed.length > 0 ? (
        <section aria-labelledby="chiusi" className="mt-10">
          <h2 id="chiusi" className="eyebrow mb-2">
            Chiusi
          </h2>
          <ul>
            {closed.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                projectCount={projectsPerGoal.get(goal.id) ?? 0}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
