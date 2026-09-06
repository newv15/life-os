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

/** A file as Telegram announces it, before anything is fetched. */
type TelegramFile = { file_id: string; file_size?: number; mime_type?: string }

export type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; first_name?: string }
    chat: { id: number; type?: string }
    text?: string
    /** What was written under a photo, which is an instruction, not a label. */
    caption?: string
    voice?: TelegramFile & { duration?: number }
    /** The same picture in several sizes, smallest first. */
    photo?: TelegramFile[]
    sticker?: TelegramFile
    document?: TelegramFile
    video?: TelegramFile
    video_note?: TelegramFile
    audio?: TelegramFile
    animation?: TelegramFile
    location?: unknown
    contact?: unknown
    poll?: unknown
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
  /** A kind of message the bot does not handle, and said so. */
  | 'unsupported'
  /** A voice note or photo that arrived but could not be made out. */
  | 'unreadable'
  | 'ignored'

export async function handleTelegramUpdate(
  deps: TelegramDeps,
  update: TelegramUpdate,
): Promise<UpdateOutcome> {
  // Telegram redelivers an update until it gets a 200. Without this, a retry
  // after a slow reply records the same expense twice.
  if (await alreadyProcessed(deps.db, update.update_id)) return 'duplicate'

  if (update.callback_query) return handleCallback(deps, update.callback_query)
  if (update.message) return handleMessage(deps, update.message)

  // Edits, joins, channel posts: nothing to do, but still a 200 so Telegram
  // stops redelivering.
  return 'ignored'
}

async function handleMessage(
  deps: TelegramDeps,
  message: NonNullable<TelegramUpdate['message']>,
): Promise<UpdateOutcome> {
  const from = message.from
  const chatId = message.chat.id

  if (!from) return 'ignored'

  // Only a private conversation. Added to a group, the bot would otherwise
  // answer every join notice and read every message in it.
  if (message.chat.type && message.chat.type !== 'private') return 'ignored'

  const content = readContent(message)
  if (content.kind === 'nothing') return 'ignored'

  // A second barrier in front of the link, for when a bot token leaks: an id
  // not on the list is answered with nothing at all.
  if (!isAllowed(deps.allowedUserIds, from.id)) return 'not_allowed'

  const text = content.kind === 'text' ? content.text : null
  const command = text ? parseCommand(text) : null
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

  if (content.kind === 'unsupported') {
    // Saying nothing is indistinguishable from being broken, and the person
    // spends the next minute wondering which it is.
    await deps.client.sendMessage(
      chatId,
      `Per ora non gestisco ${content.label}. Scrivimi, mandami un vocale o una foto.`,
    )
    return 'unsupported'
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

  // A voice note or a photo becomes words here, and from this line on the rest
  // of the system cannot tell how the message arrived.
  let prompt: string
  if (content.kind === 'text') {
    prompt = content.text
  } else {
    const understood = await understandMedia(deps, chatId, content)
    if (understood === null) return 'unreadable'
    prompt = understood
  }

  try {
    const result = await handleUserMessage({
      db: deps.db,
      userId,
      provider: deps.createProvider(),
      channel: 'telegram',
      message: prompt,
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

// --- What arrived ------------------------------------------------------------

/** What the person actually sent, once the shape of the update is read. */
type MessageContent =
  | { kind: 'text'; text: string }
  | { kind: 'voice'; fileId: string; mimeType: string; caption?: string }
  | { kind: 'photo'; fileId: string; mimeType: string; caption?: string }
  | { kind: 'unsupported'; label: string }
  | { kind: 'nothing' }

/**
 * The kinds that get a straight answer rather than silence.
 *
 * Named one by one instead of catching everything that is not text: a message
 * carrying nothing recognisable is usually Telegram's own housekeeping, and
 * replying to that would be noise. This list is things a person deliberately
 * sent.
 */
const UNSUPPORTED_KINDS: { field: keyof NonNullable<TelegramUpdate['message']>; label: string }[] = [
  { field: 'sticker', label: 'gli adesivi' },
  { field: 'document', label: 'i file allegati' },
  { field: 'video', label: 'i video' },
  { field: 'video_note', label: 'i videomessaggi' },
  { field: 'audio', label: 'i file audio' },
  { field: 'animation', label: 'le GIF' },
  { field: 'location', label: 'le posizioni' },
  { field: 'contact', label: 'i contatti' },
  { field: 'poll', label: 'i sondaggi' },
]

function readContent(message: NonNullable<TelegramUpdate['message']>): MessageContent {
  const text = message.text?.trim()
  if (text) return { kind: 'text', text }

  const caption = message.caption?.trim() || undefined

  if (message.voice) {
    return {
      kind: 'voice',
      fileId: message.voice.file_id,
      // Telegram records voice notes as OGG/Opus; the field is trusted when
      // present because it is what the model will be told.
      mimeType: message.voice.mime_type ?? 'audio/ogg',
      caption,
    }
  }

  if (message.photo && message.photo.length > 0) {
    // The largest size, not the last entry: the order is documented as
    // ascending, but on the smallest one no receipt is legible, and that is
    // too important to leave to a convention.
    const largest = message.photo.reduce((biggest, candidate) =>
      (candidate.file_size ?? 0) > (biggest.file_size ?? 0) ? candidate : biggest,
    )

    return { kind: 'photo', fileId: largest.file_id, mimeType: 'image/jpeg', caption }
  }

  const unsupported = UNSUPPORTED_KINDS.find((entry) => message[entry.field] !== undefined)
  if (unsupported) return { kind: 'unsupported', label: unsupported.label }

  return { kind: 'nothing' }
}

// --- Turning a file into words -----------------------------------------------

const VOICE_PROMPT =
  'Trascrivi questo audio in italiano, parola per parola, senza riassumere e senza aggiungere ' +
  'niente di tuo. Rispondi soltanto con la trascrizione. Se non si capisce quasi nulla, ' +
  'rispondi esattamente: INCOMPRENSIBILE.'

const PHOTO_PROMPT =
  "Guarda l'immagine e riporta in italiano quello che serve per agire senza averla vista.\n" +
  '- Se è uno scontrino o una ricevuta: importo totale, esercente, data e le voci principali.\n' +
  '- Se contiene testo scritto a mano o stampato: trascrivilo.\n' +
  '- Se è un documento o una schermata: scadenze, importi, nomi e di che cosa si tratta.\n' +
  '- Altrimenti: una riga su cosa si vede.\n' +
  'Non inventare niente: quello che non si legge, dillo.'

/** The model refuses out loud rather than guessing; this is that refusal. */
const UNREADABLE = /^incomprensibile/i

/**
 * Reads a voice note or a photo, and shows what it made of it.
 *
 * The reading is echoed before the assistant acts on it, and on purpose: a
 * transcription you only see underneath the action is one you cannot catch in
 * time. Getting "quaranta" for "quattordici" has to be visible.
 *
 * Returns null when there is nothing to act on - the person has already been
 * told why, and nothing is parked in the inbox because nothing was lost: the
 * voice note is still sitting in their Telegram chat.
 */
async function understandMedia(
  deps: TelegramDeps,
  chatId: number,
  content: Extract<MessageContent, { kind: 'voice' | 'photo' }>,
): Promise<string | null> {
  const file = await deps.client.downloadFile(content.fileId)

  if (!file.ok) {
    await deps.client.sendMessage(
      chatId,
      file.reason === 'too_large'
        ? 'Questo file è troppo grande perché riesca a leggerlo. Un vocale più corto, o una foto più leggera, e ci siamo.'
        : 'Non sono riuscito a scaricare il file da Telegram. Riprova fra un momento.',
    )
    return null
  }

  const instruction =
    (content.kind === 'voice' ? VOICE_PROMPT : PHOTO_PROMPT) +
    (content.caption ? `\n\nChi l'ha mandata l'ha accompagnata con: «${content.caption}»` : '')

  try {
    const { text } = await deps.createProvider().describeMedia({
      media: { data: file.base64, mimeType: content.mimeType },
      prompt: instruction,
      maxOutputTokens: content.kind === 'voice' ? 1024 : 1536,
    })

    if (UNREADABLE.test(text.trim())) throw new Error('il modello non ha capito il file')

    await deps.client.sendMessage(chatId, echoOfMedia(content.kind, text))
    return text
  } catch (error) {
    console.error('[telegram] lettura del file non riuscita', error)
    await deps.client.sendMessage(
      chatId,
      content.kind === 'voice'
        ? 'Non sono riuscito a capire il vocale. Riprova, oppure scrivimelo.'
        : "Non sono riuscito a leggere la foto. Riprova, oppure scrivimi cosa c'è.",
    )
    return null
  }
}

/** Long enough to check, short enough not to bury the answer that follows. */
const ECHO_LIMIT = 600

function echoOfMedia(kind: 'voice' | 'photo', text: string): string {
  const trimmed = text.length > ECHO_LIMIT ? `${text.slice(0, ECHO_LIMIT)}…` : text

  return kind === 'voice'
    ? `<i>Ho sentito:</i> «${escapeHtml(trimmed)}»`
    : `<i>Nella foto leggo:</i> ${escapeHtml(trimmed)}`
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
