import { ConflictError, NotFoundError, parseOrThrow } from '@/lib/services/errors'
import {
  deleteCheckedItems,
  deleteListRow,
  insertItems,
  insertList,
  selectAllItems,
  selectItemById,
  selectItems,
  selectListById,
  selectListByName,
  selectLists,
  updateItemRow,
  type ListItemRow,
  type ListRow,
} from '@/lib/db/repositories/lists'
import { addItemsSchema, createListSchema } from '@/lib/validation/list'
import type { Db, Enums } from '@/lib/db/types'

export type { ListItemRow, ListRow }

/** A list as the index page shows it: the name, and how much of it is left. */
export type ListSummary = ListRow & { total: number; checked: number }

export async function createList(
  db: Db,
  userId: string,
  input: unknown,
  via: Enums['created_via'] = 'web',
): Promise<ListRow> {
  const data = parseOrThrow(createListSchema, input)

  const existing = await selectListByName(db, userId, data.name)
  // Not an error: asking for a list that is already there is asking for that
  // list. Refusing would only send the person looking for the one they have.
  if (existing) return existing

  return insertList(db, userId, {
    name: data.name,
    keeps_history: data.keepsHistory,
    created_via: via,
  })
}

export async function listLists(db: Db, userId: string): Promise<ListSummary[]> {
  const [lists, items] = await Promise.all([selectLists(db, userId), selectAllItems(db, userId)])

  // Counted here rather than in a view: with a few dozen lists this is one
  // extra read, and a view would be more machinery for the same two numbers.
  const counts = new Map<string, { total: number; checked: number }>()
  for (const item of items) {
    const entry = counts.get(item.list_id) ?? { total: 0, checked: 0 }
    entry.total += 1
    if (item.checked_at !== null) entry.checked += 1
    counts.set(item.list_id, entry)
  }

  return lists.map((list) => ({
    ...list,
    total: counts.get(list.id)?.total ?? 0,
    checked: counts.get(list.id)?.checked ?? 0,
  }))
}

export async function getList(
  db: Db,
  userId: string,
  id: string,
): Promise<{ list: ListRow; items: ListItemRow[] }> {
  const list = await selectListById(db, userId, id)
  if (!list) throw new NotFoundError('Lista non trovata.')

  return { list, items: await selectItems(db, userId, id) }
}

/**
 * Adds what was dictated, to the list it was meant for.
 *
 * Creates the list when there is none by that name, and says so in the return
 * value so the caller can repeat it back. That is the one place the assistant
 * is allowed to invent something: a list is an empty container, not a fact
 * about someone's life, and the echo makes a misheard name correctable.
 */
export async function addItems(
  db: Db,
  userId: string,
  input: unknown,
  via: Enums['created_via'] = 'web',
): Promise<{ list: ListRow; createdList: boolean; items: ListItemRow[] }> {
  const data = parseOrThrow(addItemsSchema, input)

  const existing = await selectListByName(db, userId, data.listName)
  const list =
    existing ??
    (await insertList(db, userId, {
      name: data.listName,
      keeps_history: false,
      created_via: via,
    }))

  // New items go to the end, in the order they were said. Sorting them would
  // lose the only ordering the person actually gave.
  const current = await selectItems(db, userId, list.id)
  const nextPosition = current.reduce((highest, item) => Math.max(highest, item.position), -1) + 1

  const items = await insertItems(db, userId, list.id, data.items, nextPosition, via)

  return { list, createdList: existing === null, items }
}

export async function setItemChecked(
  db: Db,
  userId: string,
  itemId: string,
  checked: boolean,
): Promise<ListItemRow> {
  const updated = await updateItemRow(db, userId, itemId, {
    checked_at: checked ? new Date().toISOString() : null,
  })

  if (!updated) throw new NotFoundError('Voce non trovata.')
  return updated
}

/**
 * Clears the ticked items, so the list can be used again next time.
 *
 * Refused on a list that keeps its history: there, the ticked part is the
 * point of the list - the films actually watched - and removing it would be
 * deleting the content rather than tidying it.
 */
export async function clearChecked(db: Db, userId: string, listId: string): Promise<number> {
  const list = await selectListById(db, userId, listId)
  if (!list) throw new NotFoundError('Lista non trovata.')

  if (list.keeps_history) {
    throw new ConflictError(
      `La lista «${list.name}» tiene lo storico: le voci spuntate sono il suo contenuto, non scarto.`,
    )
  }

  return deleteCheckedItems(db, userId, listId)
}

export async function deleteList(db: Db, userId: string, id: string): Promise<void> {
  const removed = await deleteListRow(db, userId, id)
  if (!removed) throw new NotFoundError('Lista non trovata.')
}

/** Resolves an item by how someone refers to it, within one list. */
export async function findItemByText(
  db: Db,
  userId: string,
  listId: string,
  text: string,
): Promise<ListItemRow[]> {
  const needle = text.trim().toLowerCase()
  const items = await selectItems(db, userId, listId)

  const open = items.filter((item) => item.checked_at === null)
  const exact = open.filter((item) => item.text.toLowerCase() === needle)
  if (exact.length > 0) return exact

  return open.filter((item) => item.text.toLowerCase().includes(needle))
}

export { selectItemById }
