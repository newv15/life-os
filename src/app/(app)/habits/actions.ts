'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { createHabit, deleteHabit, recordHabit } from '@/lib/services/habits'

function refresh() {
  revalidatePath('/habits')
  revalidatePath('/')
}

export async function createHabitAction(
  _prev: ActionResult<string> | null,
  formData: FormData,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    const frequency = String(formData.get('frequency') ?? 'daily')

    await createHabit(db, userId, {
      name: formData.get('name'),
      frequency,
      // A daily habit has no chosen days; sending the checkboxes anyway would
      // make the schema reject a perfectly ordinary habit.
      daysOfWeek: frequency === 'weekly' ? formData.getAll('daysOfWeek') : [],
    })

    refresh()
    return crypto.randomUUID()
  })
}

export async function recordHabitAction(habitId: string, done: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await recordHabit(db, userId, habitId, { done })

    refresh()
    return undefined
  })
}

export async function deleteHabitAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await deleteHabit(db, userId, id)

    refresh()
    return undefined
  })
}
