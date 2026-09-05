import { translateDbError } from '@/lib/services/errors'
import type { Db, Enums, OwnedInsert, Row, Update } from '@/lib/db/types'

export type ProjectRow = Row<'projects'>
export type GoalRow = Row<'goals'>

const OPEN_PROJECT_STATUSES: Enums['project_status'][] = ['idea', 'active', 'paused']

export async function insertProject(
  db: Db,
  userId: string,
  values: OwnedInsert<'projects'>,
): Promise<ProjectRow> {
  const { data, error } = await db
    .from('projects')
    .insert({ ...values, user_id: userId })
    .select('*')
    .single()

  if (error) throw translateDbError(error, 'Creazione del progetto non riuscita')
  return data
}

export async function selectProjects(
  db: Db,
  userId: string,
  status: 'open' | 'all' = 'open',
): Promise<ProjectRow[]> {
  let query = db.from('projects').select('*').eq('user_id', userId)
  if (status === 'open') query = query.in('status', OPEN_PROJECT_STATUSES)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw translateDbError(error, 'Lettura dei progetti non riuscita')
  return data ?? []
}

export async function selectProjectById(
  db: Db,
  userId: string,
  id: string,
): Promise<ProjectRow | null> {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw translateDbError(error, 'Lettura del progetto non riuscita')
  return data
}

export async function updateProjectRow(
  db: Db,
  userId: string,
  id: string,
  patch: Update<'projects'>,
): Promise<ProjectRow | null> {
  const { data, error } = await db
    .from('projects')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Modifica del progetto non riuscita')
  return data
}

export async function deleteProjectRow(db: Db, userId: string, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('projects')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Eliminazione del progetto non riuscita')
  return data !== null
}

/**
 * Task counts per project, in one query.
 *
 * Progress is derived rather than stored (see migration 0012), so this fetches
 * the minimum needed to compute it: one row per task, two columns. For one
 * person that is a few hundred rows at most, and it avoids a query per project.
 */
export async function selectTaskCountsByProject(
  db: Db,
  userId: string,
): Promise<Map<string, { total: number; done: number }>> {
  const { data, error } = await db
    .from('tasks')
    .select('project_id, status')
    .eq('user_id', userId)
    .not('project_id', 'is', null)

  if (error) throw translateDbError(error, 'Conteggio dei task non riuscito')

  const counts = new Map<string, { total: number; done: number }>()
  for (const row of data ?? []) {
    if (!row.project_id) continue
    const entry = counts.get(row.project_id) ?? { total: 0, done: 0 }
    entry.total += 1
    if (row.status === 'done') entry.done += 1
    counts.set(row.project_id, entry)
  }
  return counts
}
