import { translateDbError } from '@/lib/services/errors'
import type { Db, Enums, OwnedInsert, Row, Update } from '@/lib/db/types'

/**
 * Data access for tasks. No business rules live here - only queries.
 *
 * Every function takes `userId` and filters on it. That is not redundant with
 * RLS: on the Telegram and cron paths the client uses the service role and RLS
 * does not apply at all, so this filter is the only thing standing between one
 * user's data and another's.
 */

export type TaskRow = Row<'tasks'>

export type TaskFilters = {
  /** 'open' hides done and cancelled; 'all' hides nothing. */
  status?: 'open' | 'all' | Enums['task_status']
  projectId?: string
  goalId?: string
  /** Inclusive lower and exclusive upper bound on due_at, as ISO strings. */
  dueFrom?: string
  dueBefore?: string
  limit?: number
}

const OPEN_STATUSES: Enums['task_status'][] = ['inbox', 'todo', 'doing', 'blocked']

export async function insertTask(
  db: Db,
  userId: string,
  values: OwnedInsert<'tasks'>,
): Promise<TaskRow> {
  const { data, error } = await db
    .from('tasks')
    .insert({ ...values, user_id: userId })
    .select('*')
    .single()

  if (error) throw translateDbError(error, 'Creazione del task non riuscita')
  return data
}

export async function selectTaskById(
  db: Db,
  userId: string,
  id: string,
): Promise<TaskRow | null> {
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw translateDbError(error, 'Lettura del task non riuscita')
  return data
}

export async function selectTasks(
  db: Db,
  userId: string,
  filters: TaskFilters = {},
): Promise<TaskRow[]> {
  let query = db.from('tasks').select('*').eq('user_id', userId)

  const status = filters.status ?? 'open'
  if (status === 'open') query = query.in('status', OPEN_STATUSES)
  else if (status !== 'all') query = query.eq('status', status)

  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.goalId) query = query.eq('goal_id', filters.goalId)
  if (filters.dueFrom) query = query.gte('due_at', filters.dueFrom)
  if (filters.dueBefore) query = query.lt('due_at', filters.dueBefore)

  // Dated work first, in date order; undated work after it. Priority breaks
  // ties, so an urgent task never sits below a low one on the same day.
  query = query
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw translateDbError(error, 'Lettura dei task non riuscita')
  return data ?? []
}

export async function updateTaskRow(
  db: Db,
  userId: string,
  id: string,
  patch: Update<'tasks'>,
): Promise<TaskRow | null> {
  const { data, error } = await db
    .from('tasks')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Aggiornamento del task non riuscito')
  return data
}

export async function deleteTaskRow(db: Db, userId: string, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('tasks')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Eliminazione del task non riuscita')
  return data !== null
}

export async function countTasks(
  db: Db,
  userId: string,
  filters: TaskFilters = {},
): Promise<number> {
  let query = db.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', userId)

  const status = filters.status ?? 'open'
  if (status === 'open') query = query.in('status', OPEN_STATUSES)
  else if (status !== 'all') query = query.eq('status', status)

  if (filters.dueBefore) query = query.lt('due_at', filters.dueBefore)
  if (filters.dueFrom) query = query.gte('due_at', filters.dueFrom)

  const { count, error } = await query
  if (error) throw translateDbError(error, 'Conteggio dei task non riuscito')
  return count ?? 0
}
