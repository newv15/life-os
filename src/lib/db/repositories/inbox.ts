import { translateDbError } from '@/lib/services/errors'
import type { Db, Enums, OwnedInsert, Row, Update } from '@/lib/db/types'

export type InboxItemRow = Row<'inbox_items'>

export async function insertInboxItem(
  db: Db,
  userId: string,
  values: OwnedInsert<'inbox_items'>,
): Promise<InboxItemRow> {
  const { data, error } = await db
    .from('inbox_items')
    .insert({ ...values, user_id: userId })
    .select('*')
    .single()

  if (error) throw translateDbError(error, 'Salvataggio in inbox non riuscito')
  return data
}

export async function selectInboxItems(
  db: Db,
  userId: string,
  status: Enums['inbox_status'] | 'all' = 'pending',
): Promise<InboxItemRow[]> {
  let query = db.from('inbox_items').select('*').eq('user_id', userId)
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw translateDbError(error, "Lettura dell'inbox non riuscita")
  return data ?? []
}

export async function selectInboxItemById(
  db: Db,
  userId: string,
  id: string,
): Promise<InboxItemRow | null> {
  const { data, error } = await db
    .from('inbox_items')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw translateDbError(error, "Lettura dell'elemento non riuscita")
  return data
}

export async function updateInboxItemRow(
  db: Db,
  userId: string,
  id: string,
  patch: Update<'inbox_items'>,
): Promise<InboxItemRow | null> {
  const { data, error } = await db
    .from('inbox_items')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw translateDbError(error, "Aggiornamento dell'elemento non riuscito")
  return data
}

export async function deleteInboxItemRow(db: Db, userId: string, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('inbox_items')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw translateDbError(error, "Eliminazione dell'elemento non riuscita")
  return data !== null
}
