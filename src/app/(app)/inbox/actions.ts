'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import {
  captureInboxItem,
  dismissInboxItem,
  promoteInboxItemToTask,
} from '@/lib/services/inbox'

function refresh() {
  revalidatePath('/inbox')
  revalidatePath('/tasks')
  revalidatePath('/')
}

export async function captureInboxAction(
  _prev: ActionResult<string> | null,
  formData: FormData,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await captureInboxItem(db, userId, { rawText: formData.get('rawText') })

    refresh()
    return crypto.randomUUID()
  })
}

export async function promoteToTaskAction(
  id: string,
  overrides: { title?: string; dueAt?: string },
): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await promoteInboxItemToTask(db, userId, id, overrides)

    refresh()
    return undefined
  })
}

export async function dismissInboxAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await dismissInboxItem(db, userId, id)

    refresh()
    return undefined
  })
}
