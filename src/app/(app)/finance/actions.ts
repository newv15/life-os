'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { createTransaction, deleteTransaction } from '@/lib/services/finance'

function refresh() {
  revalidatePath('/finance')
  revalidatePath('/')
}

export async function createTransactionAction(
  _prev: ActionResult<string> | null,
  formData: FormData,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await createTransaction(db, userId, {
      type: formData.get('type'),
      accountId: formData.get('accountId'),
      transferAccountId: formData.get('transferAccountId'),
      categoryId: formData.get('categoryId'),
      amount: formData.get('amount'),
      description: formData.get('description'),
      occurredOn: formData.get('occurredOn'),
    })

    refresh()
    // A fresh token per success. The form uses it as a React key, so it
    // remounts with empty fields instead of being reset from an effect.
    return crypto.randomUUID()
  })
}

export async function deleteTransactionAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await deleteTransaction(db, userId, id)

    refresh()
    return undefined
  })
}
