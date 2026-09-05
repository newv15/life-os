import { translateDbError } from '@/lib/services/errors'
import type { Db, OwnedInsert, Row, Update } from '@/lib/db/types'

export type HabitRow = Row<'habits'>
export type HabitEntryRow = Row<'habit_entries'>

export async function insertHabit(
  db: Db,
  userId: string,
  values: OwnedInsert<'habits'>,
): Promise<HabitRow> {
  const { data, error } = await db
    .from('habits')
    .insert({ ...values, user_id: userId })
    .select('*')
    .single()

  if (error) throw translateDbError(error, "Creazione dell'abitudine non riuscita")
  return data
}

export async function selectHabits(
  db: Db,
  userId: string,
  includeInactive = false,
): Promise<HabitRow[]> {
  let query = db.from('habits').select('*').eq('user_id', userId)
  if (!includeInactive) query = query.eq('active', true)

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) throw translateDbError(error, 'Lettura delle abitudini non riuscita')
  return data ?? []
}

export async function selectHabitById(
  db: Db,
  userId: string,
  id: string,
): Promise<HabitRow | null> {
  const { data, error } = await db
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw translateDbError(error, "Lettura dell'abitudine non riuscita")
  return data
}

export async function updateHabitRow(
  db: Db,
  userId: string,
  id: string,
  patch: Update<'habits'>,
): Promise<HabitRow | null> {
  const { data, error } = await db
    .from('habits')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw translateDbError(error, "Modifica dell'abitudine non riuscita")
  return data
}

export async function deleteHabitRow(db: Db, userId: string, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('habits')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw translateDbError(error, "Eliminazione dell'abitudine non riuscita")
  return data !== null
}

/**
 * Records a day, replacing whatever was there.
 *
 * The unique index on (habit_id, entry_date) makes this an upsert rather than
 * an insert: marking today twice is a tap, not an error, and undoing it has to
 * work the same way.
 */
export async function upsertHabitEntry(
  db: Db,
  userId: string,
  values: OwnedInsert<'habit_entries'>,
): Promise<HabitEntryRow> {
  const { data, error } = await db
    .from('habit_entries')
    .upsert({ ...values, user_id: userId }, { onConflict: 'habit_id,entry_date' })
    .select('*')
    .single()

  if (error) throw translateDbError(error, "Registrazione dell'abitudine non riuscita")
  return data
}

export async function selectHabitEntries(
  db: Db,
  userId: string,
  options: { from?: string; to?: string } = {},
): Promise<HabitEntryRow[]> {
  let query = db.from('habit_entries').select('*').eq('user_id', userId)

  if (options.from) query = query.gte('entry_date', options.from)
  if (options.to) query = query.lte('entry_date', options.to)

  const { data, error } = await query.order('entry_date', { ascending: false })
  if (error) throw translateDbError(error, 'Lettura dei completamenti non riuscita')
  return data ?? []
}
