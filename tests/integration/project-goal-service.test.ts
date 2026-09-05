import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseConfigured,
  type Db,
  type TestUser,
} from '../helpers/supabase'
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from '@/lib/services/projects'
import { createGoal, deleteGoal, listGoals, updateGoal } from '@/lib/services/goals'
import { completeTask, createTask, listTasks } from '@/lib/services/tasks'
import { ConflictError, NotFoundError } from '@/lib/services/errors'

describe.skipIf(!supabaseConfigured)('projects and goals', () => {
  const admin: Db = adminClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser(admin, 'projgoal')
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  describe('projects', () => {
    it('creates a project and starts it with no progress', async () => {
      const project = await createProject(admin, user.id, { name: `Sito ${Date.now()}` })

      expect(project.status).toBe('active')
      expect(project.taskCount).toBe(0)
      expect(project.doneCount).toBe(0)
      expect(project.progress).toBe(0)
    })

    it('derives progress from the tasks that belong to it', async () => {
      const project = await createProject(admin, user.id, { name: `Progresso ${Date.now()}` })

      const first = await createTask(admin, user.id, {
        title: 'Primo',
        projectId: project.id,
      })
      await createTask(admin, user.id, { title: 'Secondo', projectId: project.id })
      await createTask(admin, user.id, { title: 'Terzo', projectId: project.id })
      await completeTask(admin, user.id, first.id)

      const listed = (await listProjects(admin, user.id)).find((p) => p.id === project.id)!

      expect(listed.taskCount).toBe(3)
      expect(listed.doneCount).toBe(1)
      expect(listed.progress).toBe(33)
    })

    it('refuses two projects with the same name', async () => {
      const name = `Duplicato ${Date.now()}`
      await createProject(admin, user.id, { name })

      await expect(createProject(admin, user.id, { name })).rejects.toBeInstanceOf(ConflictError)
    })

    it('treats the same name in different case as the same name', async () => {
      const name = `Maiuscole ${Date.now()}`
      await createProject(admin, user.id, { name })

      await expect(
        createProject(admin, user.id, { name: name.toUpperCase() }),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('keeps the tasks when the project is deleted, only unlinking them', async () => {
      // Deleting a container must never destroy the work inside it. The task
      // survives and simply stops belonging anywhere.
      const project = await createProject(admin, user.id, { name: `Da chiudere ${Date.now()}` })
      const task = await createTask(admin, user.id, {
        title: 'Sopravvive al progetto',
        projectId: project.id,
      })

      await deleteProject(admin, user.id, project.id)

      const survivors = await listTasks(admin, user.id, { status: 'all' })
      const found = survivors.find((t) => t.id === task.id)

      expect(found).toBeDefined()
      expect(found!.project_id).toBeNull()
    })

    it('reports how many tasks a project holds before it is deleted', async () => {
      const project = await createProject(admin, user.id, { name: `Conteggio ${Date.now()}` })
      await createTask(admin, user.id, { title: 'Uno', projectId: project.id })
      await createTask(admin, user.id, { title: 'Due', projectId: project.id })

      const listed = (await listProjects(admin, user.id)).find((p) => p.id === project.id)!
      expect(listed.taskCount).toBe(2)
    })

    it('refuses to update a project that is not yours', async () => {
      const other = await createTestUser(admin, 'projgoal-other')
      try {
        const theirs = await createProject(admin, other.id, { name: 'Loro progetto' })

        await expect(
          updateProject(admin, user.id, theirs.id, { name: 'Rubato' }),
        ).rejects.toBeInstanceOf(NotFoundError)
      } finally {
        await deleteTestUser(admin, other.id)
      }
    }, 60_000)
  })

  describe('goals', () => {
    it('creates a numeric goal and reports how far along it is', async () => {
      const goal = await createGoal(admin, user.id, {
        title: `Risparmio ${Date.now()}`,
        horizon: 'yearly',
        startValue: '2.000',
        targetValue: '10.000',
        currentValue: '6.000',
        metricUnit: 'EUR',
      })

      expect(goal.progress).toBe(50)
    })

    it('has no percentage for a goal with no number', async () => {
      const goal = await createGoal(admin, user.id, {
        title: `Leggere ${Date.now()}`,
        horizon: 'monthly',
      })

      expect(goal.progress).toBeNull()
    })

    it('updates progress on its own', async () => {
      const goal = await createGoal(admin, user.id, {
        title: `Avanzamento ${Date.now()}`,
        horizon: 'quarterly',
        targetValue: '100',
      })

      const updated = await updateGoal(admin, user.id, goal.id, { currentValue: '75' })

      expect(Number(updated.current_value)).toBe(75)
      expect(updated.progress).toBe(75)
    })

    it('lists only the goals still being pursued by default', async () => {
      const open = await createGoal(admin, user.id, {
        title: `Aperto ${Date.now()}`,
        horizon: 'yearly',
      })
      const closed = await createGoal(admin, user.id, {
        title: `Chiuso ${Date.now()}`,
        horizon: 'yearly',
      })
      await updateGoal(admin, user.id, closed.id, { status: 'done' })

      const ids = (await listGoals(admin, user.id)).map((g) => g.id)

      expect(ids).toContain(open.id)
      expect(ids).not.toContain(closed.id)
    })

    it('keeps projects when their goal is deleted, only unlinking them', async () => {
      const goal = await createGoal(admin, user.id, {
        title: `Obiettivo effimero ${Date.now()}`,
        horizon: 'yearly',
      })
      const project = await createProject(admin, user.id, {
        name: `Sotto obiettivo ${Date.now()}`,
        goalId: goal.id,
      })

      await deleteGoal(admin, user.id, goal.id)

      const survivor = (await listProjects(admin, user.id)).find((p) => p.id === project.id)
      expect(survivor).toBeDefined()
      expect(survivor!.goal_id).toBeNull()
    })

    it("refuses to hang a project off someone else's goal", async () => {
      const other = await createTestUser(admin, 'projgoal-goal')
      try {
        const theirGoal = await createGoal(admin, other.id, {
          title: 'Obiettivo altrui',
          horizon: 'yearly',
        })

        await expect(
          createProject(admin, user.id, {
            name: `Furto ${Date.now()}`,
            goalId: theirGoal.id,
          }),
        ).rejects.toBeInstanceOf(ConflictError)
      } finally {
        await deleteTestUser(admin, other.id)
      }
    }, 60_000)
  })
})
