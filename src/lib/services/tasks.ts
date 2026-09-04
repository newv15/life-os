import { NotFoundError, parseOrThrow } from '@/lib/services/errors'
import {
  countTasks,
  deleteTaskRow,
  insertTask,
  selectTaskById,
  selectTasks,
  updateTaskRow,
  type TaskFilters,
  type TaskRow,
} from '@/lib/db/repositories/tasks'
import { createTaskSchema, updateTaskSchema } from '@/lib/validation/task'
import type { Db, Enums, Update } from '@/lib/db/types'

/**
 * Task business rules.
 *
 * The rule that shapes this file: the database holds a check constraint saying
 * `status = 'done'` exactly when `completed_at` is set. That constraint is
 * correct, and it means no caller may ever set one without the other - not the
 * web form, not an AI tool sending `{status: 'done'}`, not the cron tick. So
 * the coupling is enforced here, once, and every path goes through it.
 */

export type { TaskRow, TaskFilters }

export async function createTask(
  db: Db,
  userId: string,
  input: unknown,
  createdVia: Enums['created_via'] = 'web',
): Promise<TaskRow> {
  const data = parseOrThrow(createTaskSchema, input)

  return insertTask(db, userId, {
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    category_id: data.categoryId,
    project_id: data.projectId,
    goal_id: data.goalId,
    due_at: data.dueAt?.toISOString() ?? null,
    estimated_minutes: data.estimatedMinutes,
    recurrence_rule: data.recurrence,
    completed_at: data.status === 'done' ? new Date().toISOString() : null,
    created_via: createdVia,
  })
}

export async function getTask(db: Db, userId: string, id: string): Promise<TaskRow | null> {
  return selectTaskById(db, userId, id)
}

export async function listTasks(
  db: Db,
  userId: string,
  filters: TaskFilters = {},
): Promise<TaskRow[]> {
  return selectTasks(db, userId, filters)
}

export async function countOpenTasks(
  db: Db,
  userId: string,
  filters: TaskFilters = {},
): Promise<number> {
  return countTasks(db, userId, filters)
}

export async function updateTask(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
): Promise<TaskRow> {
  const data = parseOrThrow(updateTaskSchema, input)

  const patch: Update<'tasks'> = {}
  if (data.title !== undefined) patch.title = data.title
  if (data.description !== undefined) patch.description = data.description
  if (data.priority !== undefined) patch.priority = data.priority
  if (data.categoryId !== undefined) patch.category_id = data.categoryId
  if (data.projectId !== undefined) patch.project_id = data.projectId
  if (data.goalId !== undefined) patch.goal_id = data.goalId
  if (data.dueAt !== undefined) patch.due_at = data.dueAt?.toISOString() ?? null
  if (data.estimatedMinutes !== undefined) patch.estimated_minutes = data.estimatedMinutes
  if (data.recurrence !== undefined) patch.recurrence_rule = data.recurrence

  if (data.status !== undefined) {
    patch.status = data.status
    // Status and completion time move together or the database rejects the row.
    // Completing an already-done task must not shift the original timestamp.
    if (data.status === 'done') {
      const current = await requireTask(db, userId, id)
      patch.completed_at = current.completed_at ?? new Date().toISOString()
    } else {
      patch.completed_at = null
    }
  }

  const updated = await updateTaskRow(db, userId, id, patch)
  if (!updated) throw new NotFoundError('Task non trovato.')
  return updated
}

/** Idempotent: completing a task twice keeps the first completion time. */
export async function completeTask(db: Db, userId: string, id: string): Promise<TaskRow> {
  const current = await requireTask(db, userId, id)
  if (current.status === 'done') return current

  return updateTask(db, userId, id, { status: 'done' })
}

export async function reopenTask(db: Db, userId: string, id: string): Promise<TaskRow> {
  return updateTask(db, userId, id, { status: 'todo' })
}

export async function deleteTask(db: Db, userId: string, id: string): Promise<void> {
  await deleteTaskRow(db, userId, id)
}

async function requireTask(db: Db, userId: string, id: string): Promise<TaskRow> {
  const task = await selectTaskById(db, userId, id)
  if (!task) throw new NotFoundError('Task non trovato.')
  return task
}
