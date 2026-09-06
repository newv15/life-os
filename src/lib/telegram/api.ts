import { telegramEnv } from '@/lib/env'
import { splitForTelegram } from '@/lib/telegram/format'

/**
 * The bit that talks to Telegram.
 *
 * Behind an interface so the webhook can be tested without a network: what is
 * worth testing there is who gets let in and what they are told, not whether
 * fetch works.
 */

export type InlineButton = { text: string; callbackData: string }

/**
 * The outcome of fetching a file, with the reason when it did not arrive.
 *
 * A plain null would collapse "too big to send" and "Telegram did not answer"
 * into one silence, and those deserve different sentences: the first is
 * something the person can act on by sending a shorter voice note.
 */
export type FileDownload =
  | { ok: true; base64: string }
  | { ok: false; reason: 'too_large' | 'unavailable' }

/**
 * Past this, the request to the model would be refused anyway - Gemini takes
 * inline media up to a 20 MB request - and a phone does not produce a voice
 * note or a photo anywhere near it.
 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

export interface TelegramClient {
  sendMessage(chatId: number, text: string, buttons?: InlineButton[][]): Promise<void>
  sendTyping(chatId: number): Promise<void>
  answerCallback(callbackQueryId: string, text?: string): Promise<void>
  /** Removes the buttons from a message once it has been answered. */
  clearButtons(chatId: number, messageId: number): Promise<void>
  /** Fetches a file's bytes, base64-encoded, ready to hand to a model. */
  downloadFile(fileId: string): Promise<FileDownload>
}

export function createTelegramClient(): TelegramClient {
  const token = telegramEnv().TELEGRAM_BOT_TOKEN
  const base = `https://api.telegram.org/bot${token}`

  async function call(method: string, body: unknown): Promise<void> {
    try {
      const response = await fetch(`${base}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        // Logged rather than thrown: failing to send a reply must not make the
        // webhook return an error, or Telegram will redeliver the update and
        // the same expense gets recorded twice.
        console.error(`[telegram] ${method} ha risposto ${response.status}: ${detail.slice(0, 200)}`)
      }
    } catch (error) {
      console.error(`[telegram] ${method} non riuscito`, error)
    }
  }

  return {
    async sendMessage(chatId, text, buttons) {
      const parts = splitForTelegram(text)

      for (const [index, part] of parts.entries()) {
        await call('sendMessage', {
          chat_id: chatId,
          text: part,
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          // Buttons belong on the last piece, where the question ends up.
          reply_markup:
            buttons && index === parts.length - 1
              ? {
                  inline_keyboard: buttons.map((row) =>
                    row.map((button) => ({ text: button.text, callback_data: button.callbackData })),
                  ),
                }
              : undefined,
        })
      }
    },

    async sendTyping(chatId) {
      await call('sendChatAction', { chat_id: chatId, action: 'typing' })
    },

    async answerCallback(callbackQueryId, text) {
      await call('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
    },

    async downloadFile(fileId) {
      try {
        // Two steps, because Telegram does not serve a file by id: getFile
        // hands back a path that is valid for about an hour.
        const lookup = await fetch(`${base}/getFile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: fileId }),
        })

        const payload = (await lookup.json()) as {
          ok: boolean
          result?: { file_path?: string; file_size?: number }
        }

        const path = payload.result?.file_path
        if (!payload.ok || !path) return { ok: false, reason: 'unavailable' }

        // Checked before downloading rather than after: no reason to pull ten
        // megabytes into memory to then refuse them.
        if ((payload.result?.file_size ?? 0) > MAX_FILE_BYTES) {
          return { ok: false, reason: 'too_large' }
        }

        const file = await fetch(`https://api.telegram.org/file/bot${token}/${path}`)
        if (!file.ok) return { ok: false, reason: 'unavailable' }

        const bytes = Buffer.from(await file.arrayBuffer())
        if (bytes.byteLength > MAX_FILE_BYTES) return { ok: false, reason: 'too_large' }

        return { ok: true, base64: bytes.toString('base64') }
      } catch (error) {
        console.error('[telegram] download del file non riuscito', error)
        return { ok: false, reason: 'unavailable' }
      }
    },

    async clearButtons(chatId, messageId) {
      await call('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      })
    },
  }
}
