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

export interface TelegramClient {
  sendMessage(chatId: number, text: string, buttons?: InlineButton[][]): Promise<void>
  sendTyping(chatId: number): Promise<void>
  answerCallback(callbackQueryId: string, text?: string): Promise<void>
  /** Removes the buttons from a message once it has been answered. */
  clearButtons(chatId: number, messageId: number): Promise<void>
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

    async clearButtons(chatId, messageId) {
      await call('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      })
    },
  }
}
