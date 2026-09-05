'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { createGoal, deleteGoal, updateGoal } from '@/lib/services/goals'

function refresh() {
  revalidatePath('/goals')
  revalidatePath('/projects')
  revalidatePath('/')
}

export async function createGoalAction(
  _prev: ActionResult<string> | null,
  formData: FormData,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    // Where the goal starts is where you are when you set it. Asking for both
    // would be a form field with no answer, and defaulting the start to zero
    // would show a savings goal begun at 2.000 as already 20% done.
    await createGoal(db, userId, {
      title: formData.get('title'),
      horizon: formData.get('horizon'),
      startValue: formData.get('currentValue'),
      currentValue: formData.get('currentValue'),
      targetValue: formData.get('targetValue'),
      metricUnit: formData.get('metricUnit'),
      deadline: formData.get('deadline'),
    })

    refresh()
    return crypto.randomUUID()
  })
}

export async function updateGoalAction(
  id: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await updateGoal(db, userId, id, patch)

    refresh()
    return undefined
  })
}

export async function deleteGoalAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await deleteGoal(db, userId, id)

    refresh()
    return undefined
  })
}
