'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { createPerson, deletePerson, updatePerson } from '@/lib/services/personal'

function refresh() {
  revalidatePath('/people')
  revalidatePath('/')
}

export async function createPersonAction(
  _prev: ActionResult<string> | null,
  formData: FormData,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await createPerson(db, userId, {
      fullName: formData.get('fullName'),
      relationship: formData.get('relationship'),
      phone: formData.get('phone'),
    })

    refresh()
    return crypto.randomUUID()
  })
}

export async function updatePersonAction(
  id: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await updatePerson(db, userId, id, patch)

    refresh()
    return undefined
  })
}

export async function deletePersonAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await deletePerson(db, userId, id)

    refresh()
    return undefined
  })
}
