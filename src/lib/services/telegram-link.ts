import { randomInt } from 'node:crypto'
import { ConflictError, NotFoundError, translateDbError } from '@/lib/services/errors'
import type { Db } from '@/lib/db/types'

/**
 * Linking a Telegram account to this one.
 *
 * This is the entire authentication story of the bot, so it is worth being
 * explicit about what is trusted. Telegram sends a numeric user id, a display
 * name and sometimes a @username. Only the id is stable and unforgeable - a
 * name and a username can be changed by anyone in seconds - so the link is
 * made once, deliberately, by someone already signed in to the web app, and
 * every message afterwards is a lookup of that id.
 */

/**
 * No I, O, 0 or 1.
 *
 * This code is read off a screen and typed into a phone. A character that gets
 * misread turns into a code that fails twice before it works, and the person
 * blames the system rather than the glyph.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

/** Long enough to walk to the phone, short enough that a leaked code is dead. */
const CODE_TTL_MINUTES = 15

export type LinkCode = { code: string; expiresAt: Date }

export async function createLinkCode(db: Db, userId: string): Promise<LinkCode> {
  // Only one code may be outstanding: leaving old ones valid would mean every
  // code ever generated still opens the account.
  const { error: cleanupError } = await db
    .from('telegram_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (cleanupError) throw translateDbError(cleanupError, 'Pulizia del codice precedente non riuscita')

  const code = generateCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000)

  const { error } = await db.from('telegram_accounts').insert({
    user_id: userId,
    status: 'pending',
    link_code: code,
    link_code_expires_at: expiresAt.toISOString(),
  })

  if (error) throw translateDbError(error, 'Creazione del codice non riuscita')

  return { code, expiresAt }
}

export type RedeemedLink = { userId: string }

/**
 * Turns a typed code into a permanent link.
 *
 * Case and spacing are forgiven because this arrives from a phone keyboard;
 * nothing else is. An expired code, a used code and a code that never existed
 * all fail the same way, so the bot cannot be used to discover which codes are
 * real.
 */
export async function redeemLinkCode(
  db: Db,
  rawCode: string,
  telegramUserId: number,
  chatId: number,
): Promise<RedeemedLink> {
  const code = rawCode.trim().toUpperCase()

  const { data: pending, error } = await db
    .from('telegram_accounts')
    .select('id, user_id, link_code_expires_at')
    .eq('link_code', code)
    .eq('status', 'pending')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Verifica del codice non riuscita')
  if (!pending) throw new NotFoundError('Codice non valido o già usato.')

  if (!pending.link_code_expires_at || new Date(pending.link_code_expires_at) < new Date()) {
    throw new NotFoundError('Codice scaduto. Generane uno nuovo dalle impostazioni.')
  }

  // Checked before writing so a stolen code cannot consume itself against an
  // account that is already spoken for.
  const existing = await findLink(db, telegramUserId)
  if (existing && existing.user_id !== pending.user_id) {
    throw new ConflictError('Questo account Telegram è già collegato a un altro utente.')
  }

  const { error: updateError } = await db
    .from('telegram_accounts')
    .update({
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      status: 'active',
      linked_at: new Date().toISOString(),
      // Burned on use: a code that keeps working is a password.
      link_code: null,
      link_code_expires_at: null,
    })
    .eq('id', pending.id)

  if (updateError) throw translateDbError(updateError, 'Collegamento non riuscito')

  return { userId: pending.user_id }
}

/** The only question the webhook asks: whose account is this message? */
export async function resolveTelegramUser(
  db: Db,
  telegramUserId: number,
): Promise<string | null> {
  const { data, error } = await db
    .from('telegram_accounts')
    .select('user_id')
    .eq('telegram_user_id', telegramUserId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Riconoscimento utente non riuscito')
  return data?.user_id ?? null
}

export async function revokeTelegramLink(
  db: Db,
  userId: string,
  telegramUserId: number,
): Promise<void> {
  const { error } = await db
    .from('telegram_accounts')
    .update({ status: 'revoked' })
    .eq('user_id', userId)
    .eq('telegram_user_id', telegramUserId)

  if (error) throw translateDbError(error, 'Revoca non riuscita')
}

/** Every link on this account, for the settings screen. */
export async function listTelegramLinks(db: Db, userId: string) {
  const { data, error } = await db
    .from('telegram_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw translateDbError(error, 'Lettura dei collegamenti non riuscita')
  return data ?? []
}

async function findLink(db: Db, telegramUserId: number) {
  const { data } = await db
    .from('telegram_accounts')
    .select('id, user_id, status')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle()

  return data
}

function generateCode(): string {
  let code = ''
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    // randomInt rather than Math.random: this is a credential, however short.
    code += ALPHABET[randomInt(ALPHABET.length)]
  }
  return code
}
