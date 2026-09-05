import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseConfigured,
  type Db,
  type TestUser,
} from '../helpers/supabase'
import { createEvent, listEventsOnDay, updateEvent } from '@/lib/services/calendar'
import { createHabit, listHabits, recordHabit } from '@/lib/services/habits'
import {
  createPerson,
  getRunningTimer,
  listPeople,
  saveJournalEntry,
  startTimer,
  stopTimer,
  timeSummary,
  updatePerson,
} from '@/lib/services/personal'
import { ConflictError, ValidationError } from '@/lib/services/errors'
import { todayISO } from '@/lib/utils/date'

describe.skipIf(!supabaseConfigured)('calendar, habits, journal, people, time', () => {
  const admin: Db = adminClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser(admin, 'personal')
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  describe('calendar', () => {
    it('stores a wall clock in the user timezone', async () => {
      const event = await createEvent(admin, user.id, {
        title: 'Dal commercialista',
        startsAt: '2026-09-06T10:00',
      })

      expect(new Date(event.starts_at).toISOString()).toBe('2026-09-06T08:00:00.000Z')
    })

    it('finds what happens on a given day, by the local calendar', async () => {
      await createEvent(admin, user.id, {
        title: 'Cena tardi',
        // 23:30 local is 21:30Z the same day; UTC-based filtering would put
        // this on the wrong day for anything after 22:00.
        startsAt: '2026-09-07T23:30',
      })

      const onTheDay = await listEventsOnDay(admin, user.id, '2026-09-07')
      const dayAfter = await listEventsOnDay(admin, user.id, '2026-09-08')

      expect(onTheDay.map((e) => e.title)).toContain('Cena tardi')
      expect(dayAfter.map((e) => e.title)).not.toContain('Cena tardi')
    })

    it('refuses to end before it starts', async () => {
      await expect(
        createEvent(admin, user.id, {
          title: 'Impossibile',
          startsAt: '2026-09-06T10:00',
          endsAt: '2026-09-06T09:00',
        }),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('keeps the same rule when moving an event', async () => {
      const event = await createEvent(admin, user.id, {
        title: 'Da spostare',
        startsAt: '2026-09-06T10:00',
        endsAt: '2026-09-06T11:00',
      })

      await expect(
        updateEvent(admin, user.id, event.id, { endsAt: '2026-09-06T09:00' }),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('habits', () => {
    it('starts with no streak and nothing done', async () => {
      const habit = await createHabit(admin, user.id, { name: `Lettura ${Date.now()}` })
      const listed = (await listHabits(admin, user.id)).find((h) => h.id === habit.id)!

      expect(listed.streak).toBe(0)
      expect(listed.doneToday).toBe(false)
      expect(listed.dueToday).toBe(true)
    })

    it('counts today once it is marked', async () => {
      const habit = await createHabit(admin, user.id, { name: `Palestra ${Date.now()}` })
      await recordHabit(admin, user.id, habit.id)

      const listed = (await listHabits(admin, user.id)).find((h) => h.id === habit.id)!

      expect(listed.doneToday).toBe(true)
      expect(listed.streak).toBe(1)
    })

    it('lets a mistake be undone by marking it not done', async () => {
      // The second tap has to mean "no, I didn't", not "error: already
      // recorded" - otherwise a mis-tap is permanent.
      const habit = await createHabit(admin, user.id, { name: `Errore ${Date.now()}` })
      await recordHabit(admin, user.id, habit.id)
      await recordHabit(admin, user.id, habit.id, { done: false })

      const listed = (await listHabits(admin, user.id)).find((h) => h.id === habit.id)!

      expect(listed.doneToday).toBe(false)
      expect(listed.streak).toBe(0)
    })

    it('builds a streak across consecutive days', async () => {
      const habit = await createHabit(admin, user.id, { name: `Streak ${Date.now()}` })
      const today = todayISO()
      const shift = (days: number) => {
        const [y, m, d] = today.split('-').map(Number)
        return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
      }

      for (const offset of [-2, -1, 0]) {
        await recordHabit(admin, user.id, habit.id, { date: shift(offset) })
      }

      const listed = (await listHabits(admin, user.id)).find((h) => h.id === habit.id)!
      expect(listed.streak).toBe(3)
    })

    it('knows a weekly habit is not due today when today is not one of its days', async () => {
      const today = todayISO()
      const [y, m, d] = today.split('-').map(Number)
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7
      const otherDay = weekday === 1 ? 2 : 1

      const habit = await createHabit(admin, user.id, {
        name: `Solo un giorno ${Date.now()}`,
        frequency: 'weekly',
        daysOfWeek: [otherDay],
      })

      const listed = (await listHabits(admin, user.id)).find((h) => h.id === habit.id)!
      expect(listed.dueToday).toBe(false)
    })
  })

  describe('journal', () => {
    it('writes the day', async () => {
      const entry = await saveJournalEntry(admin, user.id, {
        entryDate: '2026-09-05',
        body: 'Giornata piena.',
        energy: 4,
        mood: 3,
      })

      expect(entry.body).toBe('Giornata piena.')
      expect(entry.energy).toBe(4)
    })

    it('rewrites the same day rather than refusing', async () => {
      // Coming back in the evening to add a line is the normal way a journal
      // gets written; failing here would lose the second thought.
      await saveJournalEntry(admin, user.id, { entryDate: '2026-09-04', body: 'Prima versione' })
      const updated = await saveJournalEntry(admin, user.id, {
        entryDate: '2026-09-04',
        body: 'Versione definitiva',
        mood: 5,
      })

      expect(updated.body).toBe('Versione definitiva')
      expect(updated.mood).toBe(5)
    })

    it('rejects a rating outside one to five', async () => {
      await expect(
        saveJournalEntry(admin, user.id, { entryDate: '2026-09-03', energy: 9 }),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('people', () => {
    it('stores a contact with whatever detail there is', async () => {
      const person = await createPerson(admin, user.id, {
        fullName: 'Marco Rossi',
        relationship: 'Commercialista',
        // Not an address, on purpose: a contact card holds what you have.
        email: 'quello del lavoro',
      })

      expect(person.full_name).toBe('Marco Rossi')
      expect(person.email).toBe('quello del lavoro')
    })

    it('records the next thing to do with someone', async () => {
      const [person] = await listPeople(admin, user.id)
      const updated = await updatePerson(admin, user.id, person.id, {
        nextAction: 'Mandare i documenti',
        nextActionAt: '2026-09-08T09:00',
      })

      expect(updated.next_action).toBe('Mandare i documenti')
      expect(new Date(updated.next_action_at!).toISOString()).toBe('2026-09-08T07:00:00.000Z')
    })
  })

  describe('time tracking', () => {
    it('runs one timer and reports it', async () => {
      const { started } = await startTimer(admin, user.id, { note: 'Primo blocco' })

      expect(started.ended_at).toBeNull()
      expect((await getRunningTimer(admin, user.id))?.id).toBe(started.id)
    })

    it('closes the previous one when a new one starts', async () => {
      // "Ora inizio a lavorare su X" means the previous thing has finished,
      // not that two are happening at once - and the database only permits one.
      const { started: first } = await startTimer(admin, user.id, { note: 'Vecchio' })
      const { started: second, stopped } = await startTimer(admin, user.id, { note: 'Nuovo' })

      expect(stopped?.id).toBe(first.id)
      expect(stopped?.ended_at).not.toBeNull()
      expect((await getRunningTimer(admin, user.id))?.id).toBe(second.id)
    })

    it('refuses to stop when nothing is running', async () => {
      await stopTimer(admin, user.id)
      await expect(stopTimer(admin, user.id)).rejects.toBeInstanceOf(ConflictError)
    })

    it('adds up what was tracked', async () => {
      // Started explicitly an hour ago rather than relying on how long the
      // test itself takes: timing a few milliseconds of test execution would
      // round to zero and prove nothing about the arithmetic.
      const anHourAgo = new Date(Date.now() - 3600_000).toISOString()
      await startTimer(admin, user.id, { note: 'Blocco lungo', startedAt: anHourAgo })
      await stopTimer(admin, user.id)

      const summary = await timeSummary(admin, user.id, '2020-01-01')

      expect(summary.totalSeconds).toBeGreaterThanOrEqual(3600)
      expect(summary.totalSeconds).toBeLessThan(3700)
    })
  })
})
