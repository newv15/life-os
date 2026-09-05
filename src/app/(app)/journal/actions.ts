'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { saveJournalEntry } from '@/lib/services/personal'

export async function saveJournalAction(
  _prev: ActionResult<string> | null,
  formData: FormData,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await saveJournalEntry(db, userId, {
      entryDate: formData.get('entryDate'),
      body: formData.get('body'),
      energy: formData.get('energy'),
      mood: formData.get('mood'),
      wins: formData.get('wins'),
      blockers: formData.get('blockers'),
    })

    revalidatePath('/journal')
    revalidatePath('/')
    return crypto.randomUUID()
  })
}
