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
  completeTask,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  reopenTask,
  updateTask,
} from '@/lib/services/tasks'
import { ValidationError } from '@/lib/services/errors'

/**
 * The task service, against the real database.
 *
 * The rule that drives most of this: `tasks` has a check constraint saying
 * status = 'done' if and only if completed_at is set. That constraint is right,
 * and it means no caller can ever be allowed to set one without the other. The
 * service is what makes that impossible - so these tests come at it from every
 * direction a form or an AI tool could.
 */

describe.skipIf(!supabaseConfigured)('task service', () => {
  const admin: Db = adminClient()
  let user: TestUser
  let projectId: string

  beforeAll(async () => {
    user = await createTestUser(admin, 'tasks')

    const { data, error } = await admin
      .from('projects')
      .insert({ user_id: user.id, name: 'Progetto di prova' })
      .select('id')
      .single()
    if (error) throw error
    projectId = data.id
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  describe('createTask', () => {
    it('stores a task and records where it came from', async () => {
      const task = await createTask(admin, user.id, { title: 'Chiamare Marco' }, 'telegram')

      expect(task.title).toBe('Chiamare Marco')
      expect(task.status).toBe('todo')
      expect(task.created_via).toBe('telegram')
      expect(task.completed_at).toBeNull()
      expect(task.user_id).toBe(user.id)
    })

    it('defaults to the web when nothing says otherwise', async () => {
      const task = await createTask(admin, user.id, { title: 'Task dal web' })
      expect(task.created_via).toBe('web')
    })

    it('stores a due date as an instant, reading a bare time as local', async () => {
      const task = await createTask(admin, user.id, {
        title: 'Dal commercialista',
        dueAt: '2026-09-05T10:00',
      })

      expect(new Date(task.due_at!).toISOString()).toBe('2026-09-05T08:00:00.000Z')
    })

    it('links to a project', async () => {
      const task = await createTask(admin, user.id, { title: 'Task del progetto', projectId })
      expect(task.project_id).toBe(projectId)
    })

    it('rejects an invalid title without writing anything', async () => {
      const before = await listTasks(admin, user.id, { status: 'all' })

      await expect(createTask(admin, user.id, { title: '   ' })).rejects.toBeInstanceOf(
        ValidationError,
      )

      const after = await listTasks(admin, user.id, { status: 'all' })
      expect(after.length).toBe(before.length)
    })

    it('refuses a due date it cannot pin down', async () => {
      await expect(
        createTask(admin, user.id, { title: 'Qualcosa', dueAt: 'venerdì prossimo' }),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('completing and reopening', () => {
    it('sets the completion time when a task is completed', async () => {
      const task = await createTask(admin, user.id, { title: 'Da completare' })
      const done = await completeTask(admin, user.id, task.id)

      expect(done.status).toBe('done')
      expect(done.completed_at).not.toBeNull()
    })

    it('keeps the original completion time when completed twice', async () => {
      const task = await createTask(admin, user.id, { title: 'Completata due volte' })
      const first = await completeTask(admin, user.id, task.id)
      const second = await completeTask(admin, user.id, task.id)

      expect(second.completed_at).toBe(first.completed_at)
    })

    it('clears the completion time when reopened', async () => {
      const task = await createTask(admin, user.id, { title: 'Da riaprire' })
      await completeTask(admin, user.id, task.id)
      const reopened = await reopenTask(admin, user.id, task.id)

      expect(reopened.status).toBe('todo')
      expect(reopened.completed_at).toBeNull()
    })

    it('sets the completion time even when done arrives through a plain update', async () => {
      // A form or an AI tool can send status directly. Without the service
      // filling in completed_at, the database check constraint would reject it.
      const task = await createTask(admin, user.id, { title: 'Fatta via update' })
      const updated = await updateTask(admin, user.id, task.id, { status: 'done' })

      expect(updated.status).toBe('done')
      expect(updated.completed_at).not.toBeNull()
    })

    it('clears the completion time when an update moves a task out of done', async () => {
      const task = await createTask(admin, user.id, { title: 'Riaperta via update' })
      await completeTask(admin, user.id, task.id)
      const updated = await updateTask(admin, user.id, task.id, { status: 'doing' })

      expect(updated.status).toBe('doing')
      expect(updated.completed_at).toBeNull()
    })
  })

  describe('updateTask', () => {
    it('changes only the fields it was given', async () => {
      const task = await createTask(admin, user.id, {
        title: 'Titolo iniziale',
        description: 'Descrizione iniziale',
        priority: 'low',
      })

      const updated = await updateTask(admin, user.id, task.id, { priority: 'urgent' })

      expect(updated.priority).toBe('urgent')
      expect(updated.title).toBe('Titolo iniziale')
      expect(updated.description).toBe('Descrizione iniziale')
    })

    it('can clear a due date', async () => {
      const task = await createTask(admin, user.id, {
        title: 'Con scadenza',
        dueAt: '2026-09-05T10:00',
      })
      const updated = await updateTask(admin, user.id, task.id, { dueAt: '' })

      expect(updated.due_at).toBeNull()
    })
  })

  describe('reading', () => {
    it('hides completed tasks from the open list by default', async () => {
      const open = await createTask(admin, user.id, { title: 'Aperta e visibile' })
      const closed = await createTask(admin, user.id, { title: 'Chiusa e nascosta' })
      await completeTask(admin, user.id, closed.id)

      const list = await listTasks(admin, user.id)
      const ids = list.map((t) => t.id)

      expect(ids).toContain(open.id)
      expect(ids).not.toContain(closed.id)
    })

    it('returns nothing for a task belonging to someone else', async () => {
      const other = await createTestUser(admin, 'tasks-other')
      try {
        const theirs = await createTask(admin, other.id, { title: 'Task altrui' })
        expect(await getTask(admin, user.id, theirs.id)).toBeNull()
      } finally {
        await deleteTestUser(admin, other.id)
      }
    }, 60_000)
  })

  describe('deleteTask', () => {
    it('removes the task', async () => {
      const task = await createTask(admin, user.id, { title: 'Da eliminare' })
      await deleteTask(admin, user.id, task.id)

      expect(await getTask(admin, user.id, task.id)).toBeNull()
    })

    it("does not remove another user's task", async () => {
      const other = await createTestUser(admin, 'tasks-victim')
      try {
        const theirs = await createTask(admin, other.id, { title: 'Non toccarmi' })
        await deleteTask(admin, user.id, theirs.id)

        expect(await getTask(admin, other.id, theirs.id)).not.toBeNull()
      } finally {
        await deleteTestUser(admin, other.id)
      }
    }, 60_000)
  })
})
