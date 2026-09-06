import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseConfigured,
  type Db,
  type TestUser,
} from '../helpers/supabase'
import { ScriptedProvider } from '../helpers/scripted-provider'
import { AIProviderError } from '@/lib/ai/provider'
import { handleTelegramUpdate, type TelegramDeps, type TelegramUpdate } from '@/lib/telegram/webhook'
import type { FileDownload, InlineButton, TelegramClient } from '@/lib/telegram/api'
import { createLinkCode } from '@/lib/services/telegram-link'
import { listTasks } from '@/lib/services/tasks'
import { listInboxItems } from '@/lib/services/inbox'

/**
 * The webhook, from the outside.
 *
 * What matters here is the order of the gates: an unknown sender gets nothing,
 * a known-but-unlinked one gets instructions, a duplicate delivery changes
 * nothing, and only after all of that does a message reach the AI.
 *
 * Every one of these is a way the bot could quietly become a way into someone
 * else's data, or a way to record the same expense twice.
 */

class RecordingClient implements TelegramClient {
  readonly sent: { chatId: number; text: string; buttons?: InlineButton[][] }[] = []
  readonly typing: number[] = []
  readonly callbacksAnswered: string[] = []
  readonly buttonsCleared: number[] = []
  /** Which file ids were actually fetched - the size chosen matters. */
  readonly downloaded: string[] = []
  /** Scriptable, so a test can play a file that is too big to send. */
  download: FileDownload = { ok: true, base64: 'ZmFrZQ==' }

  async downloadFile(fileId: string) {
    this.downloaded.push(fileId)
    return this.download
  }

  async sendMessage(chatId: number, text: string, buttons?: InlineButton[][]) {
    this.sent.push({ chatId, text, buttons })
  }
  async sendTyping(chatId: number) {
    this.typing.push(chatId)
  }
  async answerCallback(id: string) {
    this.callbacksAnswered.push(id)
  }
  async clearButtons(_chatId: number, messageId: number) {
    this.buttonsCleared.push(messageId)
  }
}

let updateSeq = 0
const nextUpdateId = () => Date.now() * 100 + (updateSeq++ % 100)

const message = (
  telegramUserId: number,
  chatId: number,
  text: string,
  updateId = nextUpdateId(),
): TelegramUpdate => ({
  update_id: updateId,
  message: { message_id: 1, from: { id: telegramUserId }, chat: { id: chatId }, text },
})

const voiceMessage = (telegramUserId: number, chatId: number): TelegramUpdate => ({
  update_id: nextUpdateId(),
  message: {
    message_id: 1,
    from: { id: telegramUserId },
    chat: { id: chatId },
    voice: { file_id: 'vocale', duration: 4, mime_type: 'audio/ogg', file_size: 9_000 },
  },
})

const photoMessage = (
  telegramUserId: number,
  chatId: number,
  caption?: string,
): TelegramUpdate => ({
  update_id: nextUpdateId(),
  message: {
    message_id: 1,
    from: { id: telegramUserId },
    chat: { id: chatId },
    // Telegram sends the same photo in several sizes, smallest first.
    photo: [
      { file_id: 'photo-piccola', file_size: 900 },
      { file_id: 'photo-grande', file_size: 90_000 },
    ],
    caption,
  },
})

describe.skipIf(!supabaseConfigured)('telegram webhook', () => {
  const admin: Db = adminClient()
  let user: TestUser
  let telegramId: number
  const chatId = 4242

  const deps = (provider = new ScriptedProvider([]), allowed: bigint[] = []): TelegramDeps => ({
    db: admin,
    client: new RecordingClient(),
    createProvider: () => provider,
    allowedUserIds: allowed,
  })

  beforeAll(async () => {
    user = await createTestUser(admin, 'tg-hook')
    telegramId = 800_000_000 + (Date.now() % 1_000_000)
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  describe('before anyone is linked', () => {
    it('tells an unknown sender how to link, without touching anything', async () => {
      const d = deps()
      const client = d.client as RecordingClient

      const outcome = await handleTelegramUpdate(d, message(telegramId, chatId, 'ciao'))

      expect(outcome).toBe('not_linked')
      expect(client.sent[0].text).toContain('/link')
    })

    it('says nothing at all to an id outside the allowlist', async () => {
      const d = deps(new ScriptedProvider([]), [BigInt(1)])
      const client = d.client as RecordingClient

      const outcome = await handleTelegramUpdate(d, message(999_999, chatId, 'ciao'))

      // Silence rather than a refusal: a bot that answers strangers tells them
      // it exists and is worth probing.
      expect(outcome).toBe('not_allowed')
      expect(client.sent).toHaveLength(0)
    })

    it('links the account when the code is right', async () => {
      const { code } = await createLinkCode(admin, user.id)
      const d = deps()
      const client = d.client as RecordingClient

      const outcome = await handleTelegramUpdate(
        d,
        message(telegramId, chatId, `/link ${code}`),
      )

      expect(outcome).toBe('processed')
      expect(client.sent[0].text).toContain('Collegato')
    })

    it('explains itself when the code is wrong, rather than going silent', async () => {
      const d = deps()
      const client = d.client as RecordingClient

      await handleTelegramUpdate(d, message(telegramId, chatId, '/link ZZZZZZZZ'))

      expect(client.sent[0].text).toMatch(/codice/i)
    })
  })

  describe('once linked', () => {
    it('answers a slash command without involving the model', async () => {
      const provider = new ScriptedProvider([])
      const d = deps(provider)
      const client = d.client as RecordingClient

      await handleTelegramUpdate(d, message(telegramId, chatId, '/finance'))

      expect(client.sent[0].text).toContain('Saldo')
      expect(provider.requests).toHaveLength(0)
    })

    it('sends a message to the AI and writes what it decided', async () => {
      const provider = new ScriptedProvider([
        {
          toolCalls: [
            { id: '1', name: 'create_task', arguments: { title: 'Chiamare il commercialista' } },
          ],
        },
        { text: 'Segnato.', toolCalls: [] },
      ])
      const d = deps(provider)
      const client = d.client as RecordingClient

      await handleTelegramUpdate(
        d,
        message(telegramId, chatId, 'devo chiamare il commercialista'),
      )

      expect(client.typing).toContain(chatId)
      expect(client.sent[0].text).toBe('Segnato.')

      const tasks = await listTasks(admin, user.id)
      expect(tasks.map((t) => t.title)).toContain('Chiamare il commercialista')
    })

    it('marks what arrived from Telegram as coming from Telegram', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [{ id: '1', name: 'create_task', arguments: { title: 'Nato su Telegram' } }] },
        { text: 'ok', toolCalls: [] },
      ])

      await handleTelegramUpdate(deps(provider), message(telegramId, chatId, 'segna una cosa'))

      const tasks = await listTasks(admin, user.id)
      expect(tasks.find((t) => t.title === 'Nato su Telegram')?.created_via).toBe('telegram')
    })

    it('escapes text so a stray angle bracket does not break the message', async () => {
      const provider = new ScriptedProvider([{ text: 'Ecco <b>tutto</b> & basta', toolCalls: [] }])
      const d = deps(provider)
      const client = d.client as RecordingClient

      await handleTelegramUpdate(d, message(telegramId, chatId, 'dimmi qualcosa'))

      expect(client.sent[0].text).toBe('Ecco &lt;b&gt;tutto&lt;/b&gt; &amp; basta')
    })

    it('lets an unknown command fall through to the AI', async () => {
      const provider = new ScriptedProvider([{ text: 'Non conosco quel comando.', toolCalls: [] }])
      const d = deps(provider)

      await handleTelegramUpdate(d, message(telegramId, chatId, '/spesa 35'))

      expect(provider.requests).toHaveLength(1)
    })

    it('ignores an update with no text instead of failing', async () => {
      const outcome = await handleTelegramUpdate(deps(), {
        update_id: nextUpdateId(),
        message: { message_id: 2, from: { id: telegramId }, chat: { id: chatId } },
      })

      expect(outcome).toBe('ignored')
    })

    describe('vocali e foto', () => {
      it('turns a voice note into a message, and says what it heard before acting', async () => {
        const provider = new ScriptedProvider([
          { toolCalls: [{ id: '1', name: 'create_task', arguments: { title: 'Comprare il pane' } }] },
          { text: 'Fatto.', toolCalls: [] },
        ])
        provider.transcript = 'devo comprare il pane'
        const d = deps(provider)
        const client = d.client as RecordingClient

        const outcome = await handleTelegramUpdate(d, voiceMessage(telegramId, chatId))

        expect(outcome).toBe('processed')
        // What it heard arrives first, while the model is still working: a
        // transcription you only see after the action is one you cannot catch
        // in time.
        expect(client.sent[0].text).toContain('devo comprare il pane')
        expect(client.sent[1].text).toBe('Fatto.')

        // And the model was handed the words, not the audio.
        expect(provider.requests[0].messages.at(-1)?.content).toBe('devo comprare il pane')

        const tasks = await listTasks(admin, user.id)
        expect(tasks.map((t) => t.title)).toContain('Comprare il pane')
      })

      it('reads a photo, taking the caption as the instruction', async () => {
        const provider = new ScriptedProvider([{ text: 'Registrata.', toolCalls: [] }])
        provider.transcript = 'Scontrino Conad, 35,20 euro, 4 settembre'
        const d = deps(provider)

        await handleTelegramUpdate(d, photoMessage(telegramId, chatId, 'questa è la spesa'))

        expect(provider.mediaPrompts[0]).toContain('questa è la spesa')
        expect(provider.requests[0].messages.at(-1)?.content).toContain('Scontrino Conad')
      })

      it('asks for the largest photo, not the thumbnail', async () => {
        // Telegram offers the same picture in several sizes. On the smallest,
        // no receipt is legible.
        const d = deps(new ScriptedProvider([{ text: 'ok', toolCalls: [] }]))
        const client = d.client as RecordingClient

        await handleTelegramUpdate(d, photoMessage(telegramId, chatId))

        expect(client.downloaded).toEqual(['photo-grande'])
      })

      it('says it could not make out the audio instead of inventing something', async () => {
        const provider = new ScriptedProvider([{ text: 'non dovrei essere chiamato', toolCalls: [] }])
        provider.mediaError = new AIProviderError('audio illeggibile', 'scripted')
        const d = deps(provider)
        const client = d.client as RecordingClient

        await handleTelegramUpdate(d, voiceMessage(telegramId, chatId))

        expect(client.sent[0].text).toMatch(/non .*(capito|riuscito|sentito)/i)
        // Nothing reached the model: guessing at an unheard message is how a
        // system records a payment nobody made.
        expect(provider.requests).toHaveLength(0)
      })

      it('refuses a file too big to send, and says why', async () => {
        const d = deps()
        const client = d.client as RecordingClient
        client.download = { ok: false, reason: 'too_large' }

        await handleTelegramUpdate(d, voiceMessage(telegramId, chatId))

        expect(client.sent[0].text).toMatch(/troppo grande/i)
      })

      it('names what it cannot handle rather than going quiet', async () => {
        const d = deps()
        const client = d.client as RecordingClient

        const outcome = await handleTelegramUpdate(d, {
          update_id: nextUpdateId(),
          message: {
            message_id: 9,
            from: { id: telegramId },
            chat: { id: chatId },
            sticker: { file_id: 'adesivo' },
          },
        })

        // Silence is indistinguishable from being broken.
        expect(outcome).toBe('unsupported')
        expect(client.sent[0].text).toMatch(/adesivi|non so|non gestisco|non riesco/i)
      })
    })
  })


  describe('duplicate deliveries', () => {
    it('does the work once, however many times Telegram retries', async () => {
      const updateId = nextUpdateId()
      const before = (await listTasks(admin, user.id)).length

      const first = new ScriptedProvider([
        { toolCalls: [{ id: '1', name: 'create_task', arguments: { title: 'Una volta sola' } }] },
        { text: 'ok', toolCalls: [] },
      ])
      await handleTelegramUpdate(deps(first), message(telegramId, chatId, 'crea', updateId))

      // Telegram redelivers until it sees a 200, and a slow reply is exactly
      // when that happens. Without dedup this is a second identical expense.
      const second = new ScriptedProvider([
        { toolCalls: [{ id: '1', name: 'create_task', arguments: { title: 'Una volta sola' } }] },
        { text: 'ok', toolCalls: [] },
      ])
      const outcome = await handleTelegramUpdate(
        deps(second),
        message(telegramId, chatId, 'crea', updateId),
      )

      expect(outcome).toBe('duplicate')
      expect(second.requests).toHaveLength(0)
      expect((await listTasks(admin, user.id)).length).toBe(before + 1)
    })
  })

  describe('confirmations', () => {
    it('asks with buttons before deleting, then acts on the answer', async () => {
      const creating = new ScriptedProvider([
        { toolCalls: [{ id: '1', name: 'create_task', arguments: { title: 'Da cancellare' } }] },
        { text: 'ok', toolCalls: [] },
      ])
      await handleTelegramUpdate(deps(creating), message(telegramId, chatId, 'crea'))

      const deleting = new ScriptedProvider([
        { toolCalls: [{ id: '1', name: 'delete_task', arguments: { title: 'Da cancellare' } }] },
      ])
      const askDeps = deps(deleting)
      const askClient = askDeps.client as RecordingClient

      await handleTelegramUpdate(askDeps, message(telegramId, chatId, 'cancellalo'))

      const buttons = askClient.sent[0].buttons
      expect(buttons?.[0]).toHaveLength(2)
      expect((await listTasks(admin, user.id, { status: 'all' })).map((t) => t.title)).toContain(
        'Da cancellare',
      )

      const confirmDeps = deps()
      const confirmClient = confirmDeps.client as RecordingClient

      await handleTelegramUpdate(confirmDeps, {
        update_id: nextUpdateId(),
        callback_query: {
          id: 'cb-1',
          from: { id: telegramId },
          message: { message_id: 77, chat: { id: chatId } },
          data: buttons![0][0].callbackData,
        },
      })

      expect(confirmClient.callbacksAnswered).toContain('cb-1')
      // The buttons are removed so an old message cannot be tapped again.
      expect(confirmClient.buttonsCleared).toContain(77)
      expect(
        (await listTasks(admin, user.id, { status: 'all' })).map((t) => t.title),
      ).not.toContain('Da cancellare')
    })
  })

  describe('when the model is down', () => {
    it('keeps the message and says so', async () => {
      const before = await listInboxItems(admin, user.id)

      const broken: TelegramDeps = {
        ...deps(),
        createProvider: () => {
          throw new Error('non dovrebbe arrivare qui senza provider')
        },
      }

      // A provider that throws on construction is the same failure as one that
      // throws on call, and the person must not lose their sentence either way.
      const d: TelegramDeps = {
        ...broken,
        createProvider: () => ({
          name: 'broken',
          async executeToolCalling(): Promise<never> {
            const { AIProviderError } = await import('@/lib/ai/provider')
            throw new AIProviderError('giù', 'broken')
          },
          async describeMedia(): Promise<never> {
            throw new AIProviderError('giù', 'broken')
          },
          async generateText(): Promise<never> {
            throw new Error('non usato')
          },
          async generateStructuredOutput<T>(): Promise<T> {
            throw new Error('non usato')
          },
        }),
      }
      const client = d.client as RecordingClient

      await handleTelegramUpdate(d, message(telegramId, chatId, 'ho speso 12 euro di caffè'))

      expect(client.sent[0].text).toMatch(/inbox/i)

      const after = await listInboxItems(admin, user.id)
      expect(after.length).toBe(before.length + 1)
      expect(after[0].raw_text).toBe('ho speso 12 euro di caffè')
      expect(after[0].source).toBe('telegram')
    })
  })
})

describe.skipIf(!supabaseConfigured)('the deduplication ledger', () => {
  const admin: Db = adminClient()

  it('forgets updates old enough that Telegram will never retry them', async () => {
    // Without this the table grows by one row per message forever, in a 500 MB
    // free tier, to remember something that stops mattering after minutes.
    const ancient = 10_000_000 + (Date.now() % 1_000_000)
    const recent = ancient + 1

    await admin.from('telegram_updates').insert([
      { update_id: ancient, processed_at: new Date(Date.now() - 7 * 86_400_000).toISOString() },
      { update_id: recent, processed_at: new Date().toISOString() },
    ])

    const { pruneOldUpdates } = await import('@/lib/telegram/webhook')
    await pruneOldUpdates(admin)

    const { data } = await admin
      .from('telegram_updates')
      .select('update_id')
      .in('update_id', [ancient, recent])

    const ids = (data ?? []).map((row) => row.update_id)
    expect(ids).not.toContain(ancient)
    expect(ids).toContain(recent)

    await admin.from('telegram_updates').delete().eq('update_id', recent)
  })
})
