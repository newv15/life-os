import { NotFoundError, parseOrThrow } from '@/lib/services/errors'
import {
  deleteInboxItemRow,
  insertInboxItem,
  selectInboxItemById,
  selectInboxItems,
  updateInboxItemRow,
  type InboxItemRow,
} from '@/lib/db/repositories/inbox'
import { captureInboxSchema } from '@/lib/validation/inbox'
import { createTask, type TaskRow } from '@/lib/services/tasks'
import type { Db, Enums } from '@/lib/db/types'

export type { InboxItemRow }

/**
 * Capture is the cheapest possible operation, on purpose.
 *
 * This is where a thought lands before anyone has decided what it is. If
 * capturing could fail for an interesting reason, the person would stop
 * capturing - so the only failure is an empty message, which is a slip rather
 * than a thought.
 */
export async function captureInboxItem(
  db: Db,
  userId: string,
  input: unknown,
  source: Enums['created_via'] = 'web',
): Promise<InboxItemRow> {
  const data = parseOrThrow(captureInboxSchema, input)

  return insertInboxItem(db, userId, {
    raw_text: data.rawText,
    source,
  })
}

export async function listInboxItems(
  db: Db,
  userId: string,
  status: Enums['inbox_status'] | 'all' = 'pending',
): Promise<InboxItemRow[]> {
  return selectInboxItems(db, userId, status)
}

/**
 * Turns a captured thought into a task.
 *
 * The task is created first and the item is only marked as sorted once that
 * has worked. Getting it the other way round would mean a rejected due date
 * could swallow the note, and the thought would be gone with nothing to show
 * for it.
 *
 * Overrides let the title be tidied on the way out, since what gets captured
 * in a hurry is rarely what belongs on a task list.
 */
export async function promoteInboxItemToTask(
  db: Db,
  userId: string,
  id: string,
  overrides: Record<string, unknown>,
): Promise<TaskRow> {
  const item = await selectInboxItemById(db, userId, id)
  if (!item) throw new NotFoundError('Elemento non trovato.')

  const task = await createTask(db, userId, {
    title: item.raw_text,
    ...overrides,
  })

  await updateInboxItemRow(db, userId, id, {
    status: 'triaged',
    triaged_at: new Date().toISOString(),
    promoted_entity_type: 'task',
    promoted_entity_id: task.id,
  })

  return task
}

export async function dismissInboxItem(db: Db, userId: string, id: string): Promise<void> {
  const updated = await updateInboxItemRow(db, userId, id, {
    status: 'dismissed',
    triaged_at: new Date().toISOString(),
  })

  if (!updated) throw new NotFoundError('Elemento non trovato.')
}

export async function deleteInboxItem(db: Db, userId: string, id: string): Promise<void> {
  await deleteInboxItemRow(db, userId, id)
}
