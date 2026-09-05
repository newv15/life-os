'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { createEvent, deleteEvent } from '@/lib/services/calendar'

function refresh() {
  revalidatePath('/calendar')
  revalidatePath('/')
}

export async function createEventAction(
  _prev: ActionResult<string> | null,
  formData: FormData,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await createEvent(db, userId, {
      title: formData.get('title'),
      startsAt: formData.get('startsAt'),
      endsAt: formData.get('endsAt'),
      location: formData.get('location'),
    })

    refresh()
    return crypto.randomUUID()
  })
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await deleteEvent(db, userId, id)

    refresh()
    return undefined
  })
}
