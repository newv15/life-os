import type { AIProvider } from '@/lib/ai/provider'
import { handleUserMessage, resolveConfirmation } from '@/lib/ai/service'
import { AppError } from '@/lib/services/errors'
import { redeemLinkCode, resolveTelegramUser } from '@/lib/services/telegram-link'
import { escapeHtml, parseCommand } from '@/lib/telegram/format'
import { runCommand } from '@/lib/telegram/commands'
import type { TelegramClient } from '@/lib/telegram/api'
import type { Db } from '@/lib/db/types'

/**
 * What happens when Telegram delivers an update.
 *
 * The order of the checks is the security model, and it is deliberate:
 * the secret header is verified by the route before this is called, then the
 * update is deduplicated, then the sender is matched to an account. Only after
 * all three does anything reach the AI or the database.
 *
 * Written as a function over injected dependencies rather than reading them
 * from the environment, so the whole path can be tested without a bot token,
 * a network, or a real model.
 */

export type TelegramDeps = {
  db: Db
  client: TelegramClient
  /** Built lazily: a message that never reaches the AI should not need one. */
  createProvider: () => AIProvider
  /** Empty means the database link is the only gate, which is already an
   *  identity check rather than a name. */
  allowedUserIds: bigint[]
}

export type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; first_name?: string }
    chat: { id: number }
    text?: string
  }
  callback_query?: {
    id: string
    from: { id: number }
    message?: { message_id: number; chat: { id: number } }
    data?: string
  }
}

export type UpdateOutcome =
  | 'processed'
  | 'duplicate'
  | 'not_allowed'
  | 'not_linked'
  | 'ignored'

export async function handleTelegramUpdate(
  deps: TelegramDeps,
  update: TelegramUpdate,
): Promise<UpdateOutcome> {
  // Telegram redelivers an update until it gets a 200. Without this, a retry
  // after a slow reply records the same expense twice.
  if (await alreadyProcessed(deps.db, update.update_id)) return 'duplicate'

  if (update.callback_query) return handleCallback(deps, update.callback_query)
  if (update.message?.text) return handleMessage(deps, update.message)

  // Photos, stickers, joins: nothing to do, but still a 200 so Telegram stops.
  return 'ignored'
}

async function handleMessage(
  deps: TelegramDeps,
  message: NonNullable<TelegramUpdate['message']>,
): Promise<UpdateOutcome> {
  const from = message.from
  const chatId = message.chat.id
  const text = message.text!.trim()

  if (!from) return 'ignored'

  // A second barrier in front of the link, for when a bot token leaks: an id
  // not on the list is answered with nothing at all.
  if (!isAllowed(deps.allowedUserIds, from.id)) return 'not_allowed'

  const command = parseCommand(text)
  const userId = await resolveTelegramUser(deps.db, from.id)

  // /link and /start have to work before there is an account to work with -
  // that is the whole point of them.
  if (command?.command === 'link') {
    return handleLink(deps, chatId, from.id, command.args)
  }

  if (!userId) {
    await deps.client.sendMessage(
      chatId,
      command?.command === 'start'
        ? 'Ciao. Questo bot è collegato a un solo account.\n\n' +
            'Apri il Life OS dal browser, vai in Impostazioni e genera un codice di collegamento. ' +
            'Poi mandamelo qui scrivendo <code>/link CODICE</code>.'
        : 'Non ti riconosco. Genera un codice dalle Impostazioni del Life OS e mandamelo con <code>/link CODICE</code>.',
    )
    return 'not_linked'
  }

  await deps.client.sendTyping(chatId)

  if (command) {
    const reply = await runCommand(deps.db, userId, command)
    if (reply) {
      await deps.client.sendMessage(chatId, reply)
      return 'processed'
    }
    // An unknown command falls through to the AI: "/spesa 35" is closer to
    // speech than to a typo, and refusing it would be pedantic.
  }

  try {
    const result = await handleUserMessage({
      db: deps.db,
      userId,
      provider: deps.createProvider(),
      channel: 'telegram',
      message: text,
      telegramChatId: chatId,
    })

    await deps.client.sendMessage(
      chatId,
      escapeHtml(result.reply),
      result.pendingConfirmation
        ? [
            [
              { text: 'Sì, procedi', callbackData: `confirm:${result.pendingConfirmation.id}:yes` },
              { text: 'No', callbackData: `confirm:${result.pendingConfirmation.id}:no` },
            ],
          ]
        : undefined,
    )
  } catch (error) {
    console.error('[telegram] elaborazione fallita', error)
    await deps.client.sendMessage(
      chatId,
      'Qualcosa è andato storto da questa parte. Riprova fra poco.',
    )
  }

  return 'processed'
}

async function handleLink(
  deps: TelegramDeps,
  chatId: number,
  telegramUserId: number,
  code: string,
): Promise<UpdateOutcome> {
  if (code === '') {
    await deps.client.sendMessage(
      chatId,
      'Scrivi <code>/link</code> seguito dal codice che trovi nelle Impostazioni del Life OS.',
    )
    return 'processed'
  }

  try {
    await redeemLinkCode(deps.db, code, telegramUserId, chatId)
    await deps.client.sendMessage(
      chatId,
      'Collegato. Da adesso puoi scrivermi normalmente:\n\n' +
        '«ho speso 35 euro al supermercato»\n' +
        '«domani alle 10 devo chiamare il commercialista»\n' +
        '«come sto messo questa settimana?»',
    )
  } catch (error) {
    const message =
      error instanceof AppError ? error.message : 'Non sono riuscito a collegare l\'account.'
    await deps.client.sendMessage(chatId, escapeHtml(message))
  }

  return 'processed'
}

async function handleCallback(
  deps: TelegramDeps,
  callback: NonNullable<TelegramUpdate['callback_query']>,
): Promise<UpdateOutcome> {
  if (!isAllowed(deps.allowedUserIds, callback.from.id)) return 'not_allowed'

  const userId = await resolveTelegramUser(deps.db, callback.from.id)
  if (!userId) return 'not_linked'

  const chatId = callback.message?.chat.id
  const [kind, confirmationId, answer] = (callback.data ?? '').split(':')

  if (kind !== 'confirm' || !confirmationId) {
    await deps.client.answerCallback(callback.id)
    return 'ignored'
  }

  const result = await resolveConfirmation({
    db: deps.db,
    userId,
    confirmationId,
    confirmed: answer === 'yes',
    channel: 'telegram',
  })

  await deps.client.answerCallback(callback.id)

  // The buttons go away once used, so the same confirmation cannot be tapped
  // again from an old message.
  if (chatId && callback.message) {
    await deps.client.clearButtons(chatId, callback.message.message_id)
    await deps.client.sendMessage(chatId, escapeHtml(result.reply))
  }

  return 'processed'
}

function isAllowed(allowed: bigint[], telegramUserId: number): boolean {
  if (allowed.length === 0) return true
  return allowed.includes(BigInt(telegramUserId))
}

/** Telegram gives up retrying long before this. Anything older is dead weight. */
const UPDATE_RETENTION_DAYS = 2

/** Roughly one message in twenty triggers a cleanup, which is plenty. */
const PRUNE_EVERY = 20

/**
 * Records the update id, and reports whether it had already been seen.
 *
 * The insert is the test: the primary key makes a duplicate fail, which is
 * atomic in a way that "select then insert" is not - and two deliveries of the
 * same update can genuinely arrive at once.
 */
async function alreadyProcessed(db: Db, updateId: number): Promise<boolean> {
  const { error } = await db.from('telegram_updates').insert({ update_id: updateId })

  if (error?.code === '23505') return true

  if (error) {
    console.error('[telegram] deduplica non riuscita', error)
    // Better to risk processing twice than to drop a message on a hiccup.
    return false
  }

  // Otherwise this table grows by one row per message forever, in a 500 MB
  // free tier, to remember something that stops mattering after minutes.
  // Doing it occasionally rather than every time keeps the common path to a
  // single insert.
  if (updateId % PRUNE_EVERY === 0) await pruneOldUpdates(db)

  return false
}

export async function pruneOldUpdates(db: Db): Promise<void> {
  const cutoff = new Date(Date.now() - UPDATE_RETENTION_DAYS * 86_400_000).toISOString()

  const { error } = await db.from('telegram_updates').delete().lt('processed_at', cutoff)
  if (error) console.error('[telegram] pulizia degli update non riuscita', error)
}
