import { translateDbError } from '@/lib/services/errors'
import type { Db, Enums, OwnedInsert, Row, Update } from '@/lib/db/types'

export type GoalRow = Row<'goals'>

const OPEN_GOAL_STATUSES: Enums['goal_status'][] = ['active', 'paused']

export async function insertGoal(
  db: Db,
  userId: string,
  values: OwnedInsert<'goals'>,
): Promise<GoalRow> {
  const { data, error } = await db
    .from('goals')
    .insert({ ...values, user_id: userId })
    .select('*')
    .single()

  if (error) throw translateDbError(error, "Creazione dell'obiettivo non riuscita")
  return data
}

export async function selectGoals(
  db: Db,
  userId: string,
  status: 'open' | 'all' = 'open',
): Promise<GoalRow[]> {
  let query = db.from('goals').select('*').eq('user_id', userId)
  if (status === 'open') query = query.in('status', OPEN_GOAL_STATUSES)

  const { data, error } = await query
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw translateDbError(error, 'Lettura degli obiettivi non riuscita')
  return data ?? []
}

export async function selectGoalById(
  db: Db,
  userId: string,
  id: string,
): Promise<GoalRow | null> {
  const { data, error } = await db
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw translateDbError(error, "Lettura dell'obiettivo non riuscita")
  return data
}

export async function updateGoalRow(
  db: Db,
  userId: string,
  id: string,
  patch: Update<'goals'>,
): Promise<GoalRow | null> {
  const { data, error } = await db
    .from('goals')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw translateDbError(error, "Modifica dell'obiettivo non riuscita")
  return data
}

export async function deleteGoalRow(db: Db, userId: string, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('goals')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw translateDbError(error, "Eliminazione dell'obiettivo non riuscita")
  return data !== null
}
