'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { createLinkCode, revokeTelegramLink } from '@/lib/services/telegram-link'

export async function createLinkCodeAction(): Promise<
  ActionResult<{ code: string; expiresAt: string }>
> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    const { code, expiresAt } = await createLinkCode(db, userId)

    revalidatePath('/settings')
    return { code, expiresAt: expiresAt.toISOString() }
  })
}

export async function revokeTelegramLinkAction(telegramUserId: number): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await revokeTelegramLink(db, userId, telegramUserId)

    revalidatePath('/settings')
    return undefined
  })
}
