import { NextResponse, type NextRequest } from 'next/server'
import { createAIProvider } from '@/lib/ai/factory'
import { createAdminClient } from '@/lib/db/admin'
import { telegramEnv } from '@/lib/env'
import { createTelegramClient } from '@/lib/telegram/api'
import { handleTelegramUpdate, type TelegramUpdate } from '@/lib/telegram/webhook'

/**
 * Where Telegram delivers.
 *
 * Two rules govern the responses here, and they pull in opposite directions:
 *
 *  - A request without the right secret gets 401 and nothing else. This
 *    endpoint is public, so the header is the only thing separating Telegram
 *    from anyone who guessed the URL.
 *  - Everything past that returns 200, even when it fails. Telegram redelivers
 *    an update until it sees one, so a non-200 on a message we already acted on
 *    means doing it again - a second identical expense, recorded by a retry.
 *    Failures are logged instead, and the update id makes the repeat harmless
 *    if one slips through anyway.
 *
 * The service role is used here because there is no session to attach to: the
 * sender is identified by their Telegram id and nothing else, which is exactly
 * why that lookup happens before anything is read or written.
 */
/**
 * Longer than the default, because a voice note is two calls to the model: one to hear it,
 * one to act on it.
 *
 * Vercel cuts a function off at its limit with no warning to the caller, and
 * Telegram reads a dead connection as a delivery failure - so it redelivers,
 * and the work that did finish happens again.
 */
export const maxDuration = 60

export async function POST(request: NextRequest) {
  let env: ReturnType<typeof telegramEnv>
  try {
    env = telegramEnv()
  } catch (error) {
    console.error('[telegram] webhook non configurato', error)
    return NextResponse.json({ ok: false }, { status: 503 })
  }

  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: true })
  }

  if (typeof update?.update_id !== 'number') return NextResponse.json({ ok: true })

  try {
    const outcome = await handleTelegramUpdate(
      {
        db: createAdminClient(),
        client: createTelegramClient(),
        createProvider: createAIProvider,
        allowedUserIds: env.allowedUserIds,
      },
      update,
    )

    return NextResponse.json({ ok: true, outcome })
  } catch (error) {
    console.error('[telegram] update non gestito', error)
    return NextResponse.json({ ok: true })
  }
}
