import { translateDbError } from '@/lib/services/errors'
import type { Db, OwnedInsert, Row, Update } from '@/lib/db/types'

export type EventRow = Row<'events'>

export type EventFilters = {
  /** Inclusive lower and exclusive upper bound on starts_at, as ISO instants. */
  from?: string
  before?: string
  limit?: number
}

export async function insertEvent(
  db: Db,
  userId: string,
  values: OwnedInsert<'events'>,
): Promise<EventRow> {
  const { data, error } = await db
    .from('events')
    .insert({ ...values, user_id: userId })
    .select('*')
    .single()

  if (error) throw translateDbError(error, "Creazione dell'evento non riuscita")
  return data
}

export async function selectEventById(
  db: Db,
  userId: string,
  id: string,
): Promise<EventRow | null> {
  const { data, error } = await db
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw translateDbError(error, "Lettura dell'evento non riuscita")
  return data
}

export async function selectEvents(
  db: Db,
  userId: string,
  filters: EventFilters = {},
): Promise<EventRow[]> {
  let query = db.from('events').select('*').eq('user_id', userId)

  if (filters.from) query = query.gte('starts_at', filters.from)
  if (filters.before) query = query.lt('starts_at', filters.before)

  query = query.order('starts_at', { ascending: true })
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw translateDbError(error, 'Lettura degli eventi non riuscita')
  return data ?? []
}

export async function updateEventRow(
  db: Db,
  userId: string,
  id: string,
  patch: Update<'events'>,
): Promise<EventRow | null> {
  const { data, error } = await db
    .from('events')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw translateDbError(error, "Modifica dell'evento non riuscita")
  return data
}

export async function deleteEventRow(db: Db, userId: string, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('events')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw translateDbError(error, "Eliminazione dell'evento non riuscita")
  return data !== null
}
