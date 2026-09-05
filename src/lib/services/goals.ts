import { NotFoundError, parseOrThrow } from '@/lib/services/errors'
import {
  deleteGoalRow,
  insertGoal,
  selectGoalById,
  selectGoals,
  updateGoalRow,
  type GoalRow,
} from '@/lib/db/repositories/goals'
import { createGoalSchema, goalProgress, updateGoalSchema } from '@/lib/validation/goal'
import type { Db } from '@/lib/db/types'

export type { GoalRow }

/** A goal plus its percentage, or null when there is no target to measure. */
export type GoalWithProgress = GoalRow & { progress: number | null }

export async function createGoal(
  db: Db,
  userId: string,
  input: unknown,
): Promise<GoalWithProgress> {
  const data = parseOrThrow(createGoalSchema, input)

  const goal = await insertGoal(db, userId, {
    title: data.title,
    description: data.description,
    horizon: data.horizon,
    status: data.status,
    parent_goal_id: data.parentGoalId,
    metric_unit: data.metricUnit,
    start_value: data.startValue,
    target_value: data.targetValue,
    current_value: data.currentValue,
    deadline: data.deadline,
  })

  return withProgress(goal)
}

export async function listGoals(
  db: Db,
  userId: string,
  status: 'open' | 'all' = 'open',
): Promise<GoalWithProgress[]> {
  const goals = await selectGoals(db, userId, status)
  return goals.map(withProgress)
}

export async function getGoal(db: Db, userId: string, id: string): Promise<GoalRow | null> {
  return selectGoalById(db, userId, id)
}

export async function updateGoal(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
): Promise<GoalWithProgress> {
  const data = parseOrThrow(updateGoalSchema, input)

  const patch: Parameters<typeof updateGoalRow>[3] = {}
  if (data.title !== undefined) patch.title = data.title
  if (data.description !== undefined) patch.description = data.description
  if (data.horizon !== undefined) patch.horizon = data.horizon
  if (data.status !== undefined) patch.status = data.status
  if (data.parentGoalId !== undefined) patch.parent_goal_id = data.parentGoalId
  if (data.metricUnit !== undefined) patch.metric_unit = data.metricUnit
  if (data.startValue !== undefined) patch.start_value = data.startValue ?? 0
  if (data.targetValue !== undefined) patch.target_value = data.targetValue
  if (data.currentValue !== undefined) patch.current_value = data.currentValue ?? 0
  if (data.deadline !== undefined) patch.deadline = data.deadline

  const updated = await updateGoalRow(db, userId, id, patch)
  if (!updated) throw new NotFoundError('Obiettivo non trovato.')
  return withProgress(updated)
}

/** Projects hanging off a deleted goal are unlinked, never removed. */
export async function deleteGoal(db: Db, userId: string, id: string): Promise<void> {
  await deleteGoalRow(db, userId, id)
}

function withProgress(goal: GoalRow): GoalWithProgress {
  return { ...goal, progress: goalProgress(goal) }
}
