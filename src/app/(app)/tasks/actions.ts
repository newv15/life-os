'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import {
  completeTask,
  createTask,
  deleteTask,
  reopenTask,
  updateTask,
} from '@/lib/services/tasks'

/** Both screens show tasks, so both go stale when one changes. */
function refresh() {
  revalidatePath('/tasks')
  revalidatePath('/')
}

export async function createTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await createTask(db, userId, {
      title: formData.get('title'),
      dueAt: formData.get('dueAt'),
      priority: formData.get('priority') || undefined,
      projectId: formData.get('projectId'),
    })

    refresh()
    return undefined
  })
}

export async function setTaskDoneAction(id: string, done: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    if (done) await completeTask(db, userId, id)
    else await reopenTask(db, userId, id)

    refresh()
    return undefined
  })
}

export async function updateTaskAction(
  id: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await updateTask(db, userId, id, patch)

    refresh()
    return undefined
  })
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await deleteTask(db, userId, id)

    refresh()
    return undefined
  })
}
