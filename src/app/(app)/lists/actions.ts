'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import {
  addItems,
  clearChecked,
  createList,
  deleteList,
  setItemChecked,
} from '@/lib/services/lists'

function refresh() {
  revalidatePath('/lists')
}

export async function createListAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await createList(db, userId, {
      name: formData.get('name'),
      keepsHistory: formData.get('keepsHistory') === 'on',
    })

    refresh()
    return undefined
  })
}

export async function addItemAction(
  listName: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await addItems(db, userId, { listName, items: [formData.get('text')] })

    refresh()
    return undefined
  })
}

export async function toggleItemAction(id: string, checked: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await setItemChecked(db, userId, id, checked)

    refresh()
    return undefined
  })
}

export async function clearCheckedAction(listId: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await clearChecked(db, userId, listId)

    refresh()
    return undefined
  })
}

export async function deleteListAction(listId: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await deleteList(db, userId, listId)

    refresh()
    return undefined
  })
}
