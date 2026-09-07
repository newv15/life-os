import { translateDbError } from '@/lib/services/errors'
import type { Db, Enums, OwnedInsert, Row, Update } from '@/lib/db/types'

export type ListRow = Row<'lists'>
export type ListItemRow = Row<'list_items'>

export async function selectLists(db: Db, userId: string): Promise<ListRow[]> {
  const { data, error } = await db
    .from('lists')
    .select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw translateDbError(error, 'Lettura delle liste non riuscita')
  return data ?? []
}

/**
 * Finds a list by what it is called, ignoring case.
 *
 * This is how the assistant resolves "aggiungi alla spesa", so it has to match
 * the unique index the database enforces - on `lower(name)` - or the two would
 * disagree and a second "Spesa" would be created and then rejected.
 */
export async function selectListByName(
  db: Db,
  userId: string,
  name: string,
): Promise<ListRow | null> {
  const { data, error } = await db
    .from('lists')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', name.trim())
    .maybeSingle()

  if (error) throw translateDbError(error, 'Lettura della lista non riuscita')
  return data
}

export async function selectListById(db: Db, userId: string, id: string): Promise<ListRow | null> {
  const { data, error } = await db
    .from('lists')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw translateDbError(error, 'Lettura della lista non riuscita')
  return data
}

export async function insertList(
  db: Db,
  userId: string,
  values: OwnedInsert<'lists'>,
): Promise<ListRow> {
  const { data, error } = await db
    .from('lists')
    .insert({ ...values, user_id: userId })
    .select('*')
    .single()

  if (error) throw translateDbError(error, 'Creazione della lista non riuscita')
  return data
}

export async function deleteListRow(db: Db, userId: string, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('lists')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Eliminazione della lista non riuscita')
  return data !== null
}

// --- Voci --------------------------------------------------------------------

export async function selectItems(
  db: Db,
  userId: string,
  listId: string,
): Promise<ListItemRow[]> {
  const { data, error } = await db
    .from('list_items')
    .select('*')
    .eq('user_id', userId)
    .eq('list_id', listId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw translateDbError(error, 'Lettura delle voci non riuscita')
  return data ?? []
}

/** Every item of every list, for the counts on the index page. */
export async function selectAllItems(db: Db, userId: string): Promise<ListItemRow[]> {
  const { data, error } = await db.from('list_items').select('*').eq('user_id', userId)

  if (error) throw translateDbError(error, 'Lettura delle voci non riuscita')
  return data ?? []
}

export async function selectItemById(
  db: Db,
  userId: string,
  id: string,
): Promise<ListItemRow | null> {
  const { data, error } = await db
    .from('list_items')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw translateDbError(error, 'Lettura della voce non riuscita')
  return data
}

export async function insertItems(
  db: Db,
  userId: string,
  listId: string,
  texts: string[],
  startPosition: number,
  via: Enums['created_via'],
): Promise<ListItemRow[]> {
  const { data, error } = await db
    .from('list_items')
    .insert(
      texts.map((text, index) => ({
        user_id: userId,
        list_id: listId,
        text,
        position: startPosition + index,
        created_via: via,
      })),
    )
    .select('*')

  if (error) throw translateDbError(error, 'Aggiunta delle voci non riuscita')
  return data ?? []
}

export async function updateItemRow(
  db: Db,
  userId: string,
  id: string,
  patch: Update<'list_items'>,
): Promise<ListItemRow | null> {
  const { data, error } = await db
    .from('list_items')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Aggiornamento della voce non riuscito')
  return data
}

export async function deleteCheckedItems(
  db: Db,
  userId: string,
  listId: string,
): Promise<number> {
  const { data, error } = await db
    .from('list_items')
    .delete()
    .eq('user_id', userId)
    .eq('list_id', listId)
    .not('checked_at', 'is', null)
    .select('id')

  if (error) throw translateDbError(error, 'Svuotamento della lista non riuscito')
  return data?.length ?? 0
}
