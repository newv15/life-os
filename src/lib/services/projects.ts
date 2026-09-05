import { NotFoundError, parseOrThrow } from '@/lib/services/errors'
import {
  deleteProjectRow,
  insertProject,
  selectProjectById,
  selectProjects,
  selectTaskCountsByProject,
  updateProjectRow,
  type ProjectRow,
} from '@/lib/db/repositories/projects'
import { createProjectSchema, updateProjectSchema } from '@/lib/validation/project'
import type { Db } from '@/lib/db/types'

export type { ProjectRow }

/** A project plus the two numbers nobody wants to compute by eye. */
export type ProjectWithProgress = ProjectRow & {
  taskCount: number
  doneCount: number
  progress: number
}

export async function createProject(
  db: Db,
  userId: string,
  input: unknown,
): Promise<ProjectWithProgress> {
  const data = parseOrThrow(createProjectSchema, input)

  const project = await insertProject(db, userId, {
    name: data.name,
    description: data.description,
    status: data.status,
    priority: data.priority,
    started_on: data.startedOn,
    deadline: data.deadline,
    goal_id: data.goalId,
  })

  return withProgress(project, { total: 0, done: 0 })
}

export async function listProjects(
  db: Db,
  userId: string,
  status: 'open' | 'all' = 'open',
): Promise<ProjectWithProgress[]> {
  const [projects, counts] = await Promise.all([
    selectProjects(db, userId, status),
    selectTaskCountsByProject(db, userId),
  ])

  return projects.map((project) => withProgress(project, counts.get(project.id)))
}

export async function getProject(
  db: Db,
  userId: string,
  id: string,
): Promise<ProjectRow | null> {
  return selectProjectById(db, userId, id)
}

export async function updateProject(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
): Promise<ProjectRow> {
  const data = parseOrThrow(updateProjectSchema, input)

  const patch: Parameters<typeof updateProjectRow>[3] = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.description !== undefined) patch.description = data.description
  if (data.status !== undefined) patch.status = data.status
  if (data.priority !== undefined) patch.priority = data.priority
  if (data.startedOn !== undefined) patch.started_on = data.startedOn
  if (data.deadline !== undefined) patch.deadline = data.deadline
  if (data.goalId !== undefined) patch.goal_id = data.goalId

  const updated = await updateProjectRow(db, userId, id, patch)
  if (!updated) throw new NotFoundError('Progetto non trovato.')
  return updated
}

/**
 * Deleting a project does not delete its tasks.
 *
 * The foreign key is ON DELETE SET NULL, so the work survives and simply stops
 * belonging anywhere. Closing a container should never be a way to lose what
 * was inside it by accident.
 */
export async function deleteProject(db: Db, userId: string, id: string): Promise<void> {
  await deleteProjectRow(db, userId, id)
}

function withProgress(
  project: ProjectRow,
  counts: { total: number; done: number } = { total: 0, done: 0 },
): ProjectWithProgress {
  const { total, done } = counts
  return {
    ...project,
    taskCount: total,
    doneCount: done,
    progress: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}
