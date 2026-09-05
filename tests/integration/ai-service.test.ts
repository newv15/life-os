import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseConfigured,
  type Db,
  type TestUser,
} from '../helpers/supabase'
import { BrokenProvider, ScriptedProvider } from '../helpers/scripted-provider'
import { handleUserMessage, resolveConfirmation } from '@/lib/ai/service'
import { listInboxItems } from '@/lib/services/inbox'
import { listTasks } from '@/lib/services/tasks'
import { listAccounts } from '@/lib/services/finance'

/**
 * The loop around the model.
 *
 * None of this tests a model's intelligence - it tests the machinery that
 * decides what a model is allowed to do with its answer: that a tool actually
 * runs, that what it did is recorded, that a destructive one stops and asks,
 * and that when the model is unavailable the person's words are not lost.
 */

const call = (name: string, args: Record<string, unknown>) => ({
  id: `call-${name}`,
  name,
  arguments: args,
})

describe.skipIf(!supabaseConfigured)('AI service', () => {
  const admin: Db = adminClient()
  let user: TestUser

  const run = (provider: ScriptedProvider | BrokenProvider, message: string) =>
    handleUserMessage({
      db: admin,
      userId: user.id,
      provider,
      channel: 'web',
      message,
    })

  beforeAll(async () => {
    user = await createTestUser(admin, 'ai')
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  describe('answering without touching anything', () => {
    it('passes the model reply straight through', async () => {
      const provider = new ScriptedProvider([{ text: 'Ciao, dimmi pure.', toolCalls: [] }])

      const result = await run(provider, 'ciao')

      expect(result.reply).toBe('Ciao, dimmi pure.')
      expect(result.executedTools).toEqual([])
    })

    it('tells the model what the tools are and when it is', async () => {
      const provider = new ScriptedProvider([{ text: 'ok', toolCalls: [] }])

      await run(provider, 'ciao')

      const [request] = provider.requests
      const system = request.messages.find((m) => m.role === 'system')

      expect(request.tools.some((tool) => tool.name === 'create_task')).toBe(true)
      // Without the current instant the model has to guess today's date, and
      // every relative deadline it computes is wrong.
      expect(system && 'content' in system ? system.content : '').toContain('2026')
    })
  })

  describe('running a tool', () => {
    it('actually writes to the database', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [call('create_task', { title: 'Chiamare il commercialista' })] },
        { text: 'Fatto, te lo sei tolto dalla testa.', toolCalls: [] },
      ])

      const result = await run(provider, 'devo chiamare il commercialista')

      expect(result.executedTools).toEqual(['create_task'])
      expect(result.reply).toBe('Fatto, te lo sei tolto dalla testa.')

      const tasks = await listTasks(admin, user.id)
      expect(tasks.map((t) => t.title)).toContain('Chiamare il commercialista')
    })

    it('marks what it wrote as coming from the AI', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [call('create_task', { title: 'Nato da un messaggio' })] },
        { text: 'ok', toolCalls: [] },
      ])

      await run(provider, 'segna una cosa')

      const tasks = await listTasks(admin, user.id)
      const created = tasks.find((t) => t.title === 'Nato da un messaggio')!
      expect(created.created_via).toBe('ai')
    })

    it('hands the result back so the model can report what happened', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [call('create_task', { title: 'Task da raccontare' })] },
        { text: 'ok', toolCalls: [] },
      ])

      await run(provider, 'crea')

      const secondRequest = provider.requests[1]
      const toolMessage = secondRequest.messages.find((m) => m.role === 'tool')

      expect(toolMessage).toBeDefined()
      expect(toolMessage && 'content' in toolMessage ? toolMessage.content : '').toContain(
        'Task da raccontare',
      )
    })

    it('records every call in the audit log', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [call('create_task', { title: 'Tracciato' })] },
        { text: 'ok', toolCalls: [] },
      ])

      await run(provider, 'crea')

      const { data } = await admin
        .from('ai_action_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('tool_name', 'create_task')
        .order('created_at', { ascending: false })
        .limit(1)

      expect(data?.[0]?.success).toBe(true)
      expect(data?.[0]?.duration_ms).toBeGreaterThanOrEqual(0)
    })

    it('keeps the conversation so the next message has context', async () => {
      const provider = new ScriptedProvider([{ text: 'ricordato', toolCalls: [] }])

      const result = await run(provider, 'un messaggio da ricordare')

      const { data } = await admin
        .from('ai_messages')
        .select('role, content')
        .eq('conversation_id', result.conversationId)
        .order('created_at', { ascending: true })

      expect(data?.map((m) => m.role)).toEqual(['user', 'assistant'])
      expect(data?.[0].content).toBe('un messaggio da ricordare')
    })
  })

  describe('when the model gets it wrong', () => {
    it('tells the model a tool does not exist instead of crashing', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [call('fai_tutto_tu', {})] },
        { text: 'Chiedo scusa, riprovo.', toolCalls: [] },
      ])

      const result = await run(provider, 'fai qualcosa')

      expect(result.reply).toBe('Chiedo scusa, riprovo.')
      const toolMessage = provider.requests[1].messages.find((m) => m.role === 'tool')
      expect(toolMessage && 'content' in toolMessage ? toolMessage.content : '').toMatch(/non esiste|sconosciut/i)
    })

    it('feeds a rejected date back so the model can ask instead of guessing', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [call('create_task', { title: 'Qualcosa', dueAt: 'venerdì' })] },
        { text: 'Per quando esattamente?', toolCalls: [] },
      ])

      const result = await run(provider, 'ricordamelo venerdì')

      expect(result.reply).toBe('Per quando esattamente?')

      const toolMessage = provider.requests[1].messages.find((m) => m.role === 'tool')
      expect(toolMessage && 'content' in toolMessage ? toolMessage.content : '').toMatch(/data/i)

      // Nothing was written: a task with the wrong date is worse than none.
      const tasks = await listTasks(admin, user.id)
      expect(tasks.map((t) => t.title)).not.toContain('Qualcosa')
    })

    it('records the failure in the audit log too', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [call('create_task', { title: '' })] },
        { text: 'ok', toolCalls: [] },
      ])

      await run(provider, 'crea niente')

      const { data } = await admin
        .from('ai_action_logs')
        .select('success, error')
        .eq('user_id', user.id)
        .eq('success', false)
        .limit(1)

      expect(data?.[0]).toBeDefined()
      expect(data?.[0].error).toBeTruthy()
    })

    it('stops after a few rounds instead of looping forever', async () => {
      // A model that keeps calling tools without ever answering would run up a
      // bill and never reply. The loop has to end on its own.
      const endless = Array.from({ length: 20 }, () => ({
        toolCalls: [call('list_tasks', {})],
      }))
      const provider = new ScriptedProvider(endless)

      const result = await run(provider, 'gira a vuoto')

      expect(provider.requests.length).toBeLessThanOrEqual(6)
      expect(result.reply).toBeTruthy()
    })
  })

  describe('destructive actions', () => {
    it('does not delete anything without asking first', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [call('create_task', { title: 'Da non perdere' })] },
        { text: 'creato', toolCalls: [] },
      ])
      await run(provider, 'crea')

      const deleting = new ScriptedProvider([
        { toolCalls: [call('delete_task', { title: 'Da non perdere' })] },
      ])
      const result = await run(deleting, 'cancella quel task')

      expect(result.pendingConfirmation).toBeDefined()
      expect(result.pendingConfirmation!.question).toContain('Da non perdere')
      expect(result.executedTools).toEqual([])

      // Still there until a human says yes.
      const tasks = await listTasks(admin, user.id, { status: 'all' })
      expect(tasks.map((t) => t.title)).toContain('Da non perdere')
    })

    it('carries it out once confirmed', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [call('create_task', { title: 'Destinato a sparire' })] },
        { text: 'creato', toolCalls: [] },
      ])
      await run(provider, 'crea')

      const deleting = new ScriptedProvider([
        { toolCalls: [call('delete_task', { title: 'Destinato a sparire' })] },
      ])
      const asked = await run(deleting, 'cancella')

      const done = await resolveConfirmation({
        db: admin,
        userId: user.id,
        confirmationId: asked.pendingConfirmation!.id,
        confirmed: true,
        channel: 'web',
      })

      expect(done.reply).toContain('Destinato a sparire')

      const tasks = await listTasks(admin, user.id, { status: 'all' })
      expect(tasks.map((t) => t.title)).not.toContain('Destinato a sparire')
    })

    it('leaves it alone when the answer is no', async () => {
      const provider = new ScriptedProvider([
        { toolCalls: [call('create_task', { title: 'Salvato dal no' })] },
        { text: 'creato', toolCalls: [] },
      ])
      await run(provider, 'crea')

      const deleting = new ScriptedProvider([
        { toolCalls: [call('delete_task', { title: 'Salvato dal no' })] },
      ])
      const asked = await run(deleting, 'cancella')

      await resolveConfirmation({
        db: admin,
        userId: user.id,
        confirmationId: asked.pendingConfirmation!.id,
        confirmed: false,
        channel: 'web',
      })

      const tasks = await listTasks(admin, user.id, { status: 'all' })
      expect(tasks.map((t) => t.title)).toContain('Salvato dal no')
    })
  })

  describe('when the model is unavailable', () => {
    it('says so plainly and keeps what the person wrote', async () => {
      const before = await listInboxItems(admin, user.id)

      const result = await run(new BrokenProvider(), 'ho speso 35 euro al supermercato')

      expect(result.reply).toMatch(/non disponibile|inbox/i)

      // The whole point: an outage must never cost the user their sentence.
      const after = await listInboxItems(admin, user.id)
      expect(after.length).toBe(before.length + 1)
      expect(after[0].raw_text).toBe('ho speso 35 euro al supermercato')
    })
  })

  describe('money through the AI', () => {
    it('records a spend against the right account and category', async () => {
      const provider = new ScriptedProvider([
        {
          toolCalls: [
            call('create_transaction', {
              amount: '35,50',
              type: 'expense',
              description: 'Supermercato',
              categoryName: 'spesa alimentare',
            }),
          ],
        },
        { text: 'Registrata.', toolCalls: [] },
      ])

      const result = await run(provider, 'ho speso 35,50 al supermercato')

      expect(result.executedTools).toEqual(['create_transaction'])

      const accounts = await listAccounts(admin, user.id)
      const main = accounts.find((a) => a.name === 'Conto principale')!
      expect(Number(main.current_balance)).toBe(-35.5)
    })

    it('refuses to invent a category that does not exist', async () => {
      const provider = new ScriptedProvider([
        {
          toolCalls: [
            call('create_transaction', {
              amount: '10',
              type: 'expense',
              categoryName: 'criptovalute',
            }),
          ],
        },
        { text: 'In quale categoria la metto?', toolCalls: [] },
      ])

      const result = await run(provider, 'ho speso 10 in bitcoin')

      // The tool reports back what does exist, so the model can ask properly
      // rather than filing the spend under whatever came first.
      const toolMessage = provider.requests[1].messages.find((m) => m.role === 'tool')
      const content = toolMessage && 'content' in toolMessage ? toolMessage.content : ''

      expect(content).toContain('criptovalute')
      expect(content).toContain('Spesa alimentare')
      expect(result.reply).toBe('In quale categoria la metto?')
    })
  })
})
