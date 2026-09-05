'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { createLinkCode, revokeTelegramLink } from '@/lib/services/telegram-link'
import { setAutomation } from '@/lib/services/automations'

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

export async function setAutomationAction(
  kind: string,
  enabled: boolean,
  timeOfDay: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await setAutomation(
      db,
      userId,
      kind as Parameters<typeof setAutomation>[2],
      enabled,
      timeOfDay,
    )

    revalidatePath('/settings')
    return undefined
  })
}
