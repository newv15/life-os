'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { createAIProvider } from '@/lib/ai/factory'
import { handleUserMessage, resolveConfirmation, type AIRunResult } from '@/lib/ai/service'

/**
 * The web side of the AI.
 *
 * A Server Action rather than the route handler the architecture sketched,
 * because on the web the user is already identified by their session: adding
 * an API route would mean a second authenticated entry point to keep correct
 * for no gain. Telegram gets its own route, since it authenticates completely
 * differently.
 */

/** An AI turn can touch anything, so everything is considered stale after one. */
function refreshEverything() {
  revalidatePath('/', 'layout')
}

export async function askAIAction(
  _prev: ActionResult<AIRunResult> | null,
  formData: FormData,
): Promise<ActionResult<AIRunResult>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    const message = String(formData.get('message') ?? '').trim()
    if (message === '') throw new Error('Scrivi qualcosa.')

    const result = await handleUserMessage({
      db,
      userId,
      provider: createAIProvider(),
      channel: 'web',
      message,
      conversationId: (formData.get('conversationId') as string) || undefined,
    })

    refreshEverything()
    return result
  })
}

export async function confirmAIAction(
  confirmationId: string,
  confirmed: boolean,
): Promise<ActionResult<AIRunResult>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    const result = await resolveConfirmation({
      db,
      userId,
      confirmationId,
      confirmed,
      channel: 'web',
    })

    refreshEverything()
    return result
  })
}
