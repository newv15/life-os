import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseConfigured,
  type Db,
  type TestUser,
} from '../helpers/supabase'
import { runTick } from '@/lib/automation/tick'
import { createEvent } from '@/lib/services/calendar'
import { createTask } from '@/lib/services/tasks'
import type { TelegramClient } from '@/lib/telegram/api'

/**
 * The scheduler.
 *
 * Everything here turns on two properties. It has to be idempotent, because
 * GitHub Actions can and will deliver the same minute twice - and a reminder
 * sent twice is worse than one sent late. And it has to catch up, because a
 * delayed or skipped run must not silently swallow the reminder it was meant
 * to send.
 */

class RecordingClient implements TelegramClient {
  readonly sent: { chatId: number; text: string }[] = []
  shouldFail = false

  async downloadFile() {
    // The scheduler only ever sends; nothing here reads a file.
    return { ok: false, reason: 'unavailable' } as const
  }

  async sendMessage(chatId: number, text: string) {
    if (this.shouldFail) throw new Error('Telegram non raggiungibile')
    this.sent.push({ chatId, text })
  }
  async sendTyping() {}
  async answerCallback() {}
  async clearButtons() {}
}

describe.skipIf(!supabaseConfigured)('cron tick', () => {
  const admin: Db = adminClient()
  let user: TestUser
  const chatId = 9911

  /** Links a Telegram account so the tick has somewhere to deliver. */
  const link = async () => {
    await admin.from('telegram_accounts').insert({
      user_id: user.id,
      telegram_user_id: 700_000_000 + (Date.now() % 1_000_000),
      chat_id: chatId,
      status: 'active',
      linked_at: new Date().toISOString(),
    })
  }

  // Every tick in this file is scoped to the throwaway user. Without it the
  // suite reaches into the real account: this job has no session and works
  // across everyone by design.
  const tick = (client: RecordingClient, now = new Date()) =>
    runTick({ db: admin, client, now, onlyUserId: user.id })

  beforeAll(async () => {
    user = await createTestUser(admin, 'tick')
    await link()
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  describe('scheduling reminders', () => {
    it('schedules one for an event about to happen', async () => {
      const now = new Date()
      await createEvent(admin, user.id, {
        title: 'Riunione imminente',
        startsAt: new Date(now.getTime() + 20 * 60_000).toISOString(),
      })

      const report = await tick(new RecordingClient(), now)
      expect(report.scheduled).toBeGreaterThan(0)

      const { data } = await admin
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('kind', 'reminder')

      expect(data?.some((n) => n.title.includes('Riunione imminente'))).toBe(true)
    })

    it('leaves an event far in the future alone', async () => {
      const now = new Date()
      await createEvent(admin, user.id, {
        title: 'Molto lontano',
        startsAt: new Date(now.getTime() + 10 * 86_400_000).toISOString(),
      })

      await tick(new RecordingClient(), now)

      const { data } = await admin
        .from('notifications')
        .select('title')
        .eq('user_id', user.id)

      expect(data?.some((n) => n.title.includes('Molto lontano'))).toBe(false)
    })

    it('does not schedule the same reminder twice', async () => {
      const now = new Date()
      await createEvent(admin, user.id, {
        title: 'Una notifica sola',
        startsAt: new Date(now.getTime() + 25 * 60_000).toISOString(),
      })

      await tick(new RecordingClient(), now)
      await tick(new RecordingClient(), now)

      const { data } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .like('title', '%Una notifica sola%')

      expect(data).toHaveLength(1)
    })

    it('schedules a task reminder for the moment it is due', async () => {
      const now = new Date()
      const dueAt = new Date(now.getTime() + 15 * 60_000)
      await createTask(admin, user.id, { title: 'Task con scadenza', dueAt: dueAt.toISOString() })

      await tick(new RecordingClient(), now)

      const { data } = await admin
        .from('notifications')
        .select('scheduled_at, title')
        .eq('user_id', user.id)
        .like('title', '%Task con scadenza%')
        .maybeSingle()

      expect(data).toBeTruthy()
      // At the deadline, not before it: a task is not an appointment you have
      // to travel to.
      expect(Math.abs(new Date(data!.scheduled_at).getTime() - dueAt.getTime())).toBeLessThan(2000)
    })

    it('still reminds about a deadline that passed while it was down', async () => {
      // The whole reason this runs on GitHub Actions is that it is free, and
      // the price of free is that it drifts and sometimes does not run at all.
      // A scheduler that only ever looks forward turns its own downtime into
      // silently dropped reminders - which is exactly what happened the first
      // time this ran in production.
      const now = new Date()
      await createTask(admin, user.id, {
        title: 'Scaduto mentre era fermo',
        dueAt: new Date(now.getTime() - 2 * 3600_000).toISOString(),
      })

      await tick(new RecordingClient(), now)

      const { data } = await admin
        .from('notifications')
        .select('title')
        .eq('user_id', user.id)
        .like('title', '%Scaduto mentre era fermo%')

      expect(data).toHaveLength(1)
    })

    it('does not dig up a deadline from last week', async () => {
      // Catching up is not the same as never letting go: a reminder days late
      // is not a reminder, and a first run after a long silence should not
      // arrive as a wall of messages nobody reads.
      const now = new Date()
      await createTask(admin, user.id, {
        title: 'Vecchio di una settimana',
        dueAt: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
      })

      await tick(new RecordingClient(), now)

      const { data } = await admin
        .from('notifications')
        .select('title')
        .eq('user_id', user.id)
        .like('title', '%Vecchio di una settimana%')

      expect(data).toHaveLength(0)
    })

    it('does not announce an appointment that has already started', async () => {
      // "Tra poco" about something that began an hour ago is worse than
      // silence: it is wrong.
      const now = new Date()
      await createEvent(admin, user.id, {
        title: 'Cominciato un ora fa',
        startsAt: new Date(now.getTime() - 3600_000).toISOString(),
      })

      await tick(new RecordingClient(), now)

      const { data } = await admin
        .from('notifications')
        .select('title')
        .eq('user_id', user.id)
        .like('title', '%Cominciato un ora fa%')

      expect(data).toHaveLength(0)
    })
  })


describe('whose reminders it touches', () => {
    /**
     * The tick is a system-wide job: it has no session, it uses the service
     * role, and it deliberately works across every account. Which means these
     * tests, run against the real project, were quietly scheduling and
     * "delivering" the actual account's reminders into a fake client - marking
     * them sent, so they never arrived on a real phone.
     *
     * That is not a hypothetical: it happened, and it swallowed a real
     * reminder. Hence a scope the production caller never passes.
     */
    it('leaves other people alone when asked to work on one account', async () => {
      const other = await createTestUser(admin, 'tick-other')

      try {
        const now = new Date()
        await createTask(admin, other.id, {
          title: 'Roba di qualcun altro',
          dueAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
        })
        await createTask(admin, user.id, {
          title: 'Roba mia',
          dueAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
        })

        await runTick({ db: admin, client: new RecordingClient(), now, onlyUserId: user.id })

        const { data: mine } = await admin
          .from('notifications')
          .select('title')
          .eq('user_id', user.id)
          .like('title', '%Roba mia%')

        const { data: theirs } = await admin
          .from('notifications')
          .select('title')
          .eq('user_id', other.id)

        expect(mine).toHaveLength(1)
        expect(theirs).toHaveLength(0)
      } finally {
        await deleteTestUser(admin, other.id)
      }
    })
  })


  describe('delivering', () => {
    it('sends what is due and marks it sent', async () => {
      const client = new RecordingClient()
      await admin.from('notifications').insert({
        user_id: user.id,
        kind: 'alert',
        title: 'Messaggio dovuto',
        body: 'Corpo del messaggio',
        scheduled_at: new Date(Date.now() - 60_000).toISOString(),
      })

      const report = await tick(client)

      expect(report.delivered).toBeGreaterThan(0)
      expect(client.sent.some((message) => message.text.includes('Messaggio dovuto'))).toBe(true)

      const { data } = await admin
        .from('notifications')
        .select('status, sent_at')
        .eq('user_id', user.id)
        .eq('title', 'Messaggio dovuto')
        .single()

      expect(data!.status).toBe('sent')
      expect(data!.sent_at).not.toBeNull()
    })

    it('never sends the same notification twice', async () => {
      const first = new RecordingClient()
      await admin.from('notifications').insert({
        user_id: user.id,
        kind: 'alert',
        title: 'Una volta sola davvero',
        scheduled_at: new Date(Date.now() - 60_000).toISOString(),
      })

      await tick(first)
      const second = new RecordingClient()
      await tick(second)

      expect(first.sent.some((m) => m.text.includes('Una volta sola davvero'))).toBe(true)
      expect(second.sent.some((m) => m.text.includes('Una volta sola davvero'))).toBe(false)
    })

    it('holds back anything not due yet', async () => {
      const client = new RecordingClient()
      await admin.from('notifications').insert({
        user_id: user.id,
        kind: 'alert',
        title: 'Ancora presto',
        scheduled_at: new Date(Date.now() + 3600_000).toISOString(),
      })

      await tick(client)

      expect(client.sent.some((m) => m.text.includes('Ancora presto'))).toBe(false)
    })

    it('catches up on something that was due hours ago', async () => {
      // A skipped or delayed run must not swallow the reminder it owed.
      const client = new RecordingClient()
      await admin.from('notifications').insert({
        user_id: user.id,
        kind: 'alert',
        title: 'Arretrato di ore',
        scheduled_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
      })

      await tick(client)

      expect(client.sent.some((m) => m.text.includes('Arretrato di ore'))).toBe(true)
    })

    it('records a failure and tries again next time', async () => {
      const failing = new RecordingClient()
      failing.shouldFail = true

      await admin.from('notifications').insert({
        user_id: user.id,
        kind: 'alert',
        title: 'Invio che fallisce',
        scheduled_at: new Date(Date.now() - 60_000).toISOString(),
      })

      await tick(failing)

      const { data: afterFailure } = await admin
        .from('notifications')
        .select('status, attempts, last_error')
        .eq('user_id', user.id)
        .eq('title', 'Invio che fallisce')
        .single()

      // Still pending, so the next run retries rather than losing it.
      expect(afterFailure!.status).toBe('pending')
      expect(afterFailure!.attempts).toBe(1)
      expect(afterFailure!.last_error).toBeTruthy()

      const working = new RecordingClient()
      await tick(working)

      expect(working.sent.some((m) => m.text.includes('Invio che fallisce'))).toBe(true)
    })

    it('gives up on something that keeps failing', async () => {
      const failing = new RecordingClient()
      failing.shouldFail = true

      await admin.from('notifications').insert({
        user_id: user.id,
        kind: 'alert',
        title: 'Senza speranza',
        scheduled_at: new Date(Date.now() - 60_000).toISOString(),
        attempts: 5,
      })

      await tick(failing)

      const { data } = await admin
        .from('notifications')
        .select('status')
        .eq('user_id', user.id)
        .eq('title', 'Senza speranza')
        .single()

      // Retrying forever would mean every tick carries a growing tail of dead
      // messages, and the real ones queue behind them.
      expect(data!.status).toBe('failed')
    })

    it('leaves notifications alone for someone with no Telegram linked', async () => {
      const other = await createTestUser(admin, 'tick-unlinked')
      try {
        await admin.from('notifications').insert({
          user_id: other.id,
          kind: 'alert',
          title: 'Nessun destinatario',
          scheduled_at: new Date(Date.now() - 60_000).toISOString(),
        })

        const client = new RecordingClient()
        await tick(client)

        const { data } = await admin
          .from('notifications')
          .select('status')
          .eq('user_id', other.id)
          .single()

        // Not marked failed: the moment a bot is connected, it arrives.
        expect(data!.status).toBe('pending')
        expect(client.sent.some((m) => m.text.includes('Nessun destinatario'))).toBe(false)
      } finally {
        await deleteTestUser(admin, other.id)
      }
    }, 60_000)
  })
})
