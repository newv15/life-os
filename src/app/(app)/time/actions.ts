'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { deleteTimeEntry, startTimer, stopTimer } from '@/lib/services/personal'

function refresh() {
  revalidatePath('/time')
  revalidatePath('/')
}

export async function startTimerAction(
  _prev: ActionResult<string> | null,
  formData: FormData,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await startTimer(db, userId, {
      note: formData.get('note'),
      projectId: formData.get('projectId'),
    })

    refresh()
    return crypto.randomUUID()
  })
}

export async function stopTimerAction(): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await stopTimer(db, userId)

    refresh()
    return undefined
  })
}

export async function deleteTimeEntryAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await deleteTimeEntry(db, userId, id)

    refresh()
    return undefined
  })
}
