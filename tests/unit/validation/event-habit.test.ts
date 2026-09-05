import { describe, expect, it } from 'vitest'
import { createEventSchema, updateEventSchema } from '@/lib/validation/event'
import { createHabitSchema, computeStreak, isScheduledOn } from '@/lib/validation/habit'

describe('createEventSchema', () => {
  it('needs a title and a start', () => {
    const event = createEventSchema.parse({
      title: 'Dal commercialista',
      startsAt: '2026-09-06T10:00',
    })

    expect(event.title).toBe('Dal commercialista')
    expect(event.startsAt.toISOString()).toBe('2026-09-06T08:00:00.000Z')
    expect(event.endsAt).toBeNull()
    expect(event.allDay).toBe(false)
  })

  it('rejects an event with no start', () => {
    expect(createEventSchema.safeParse({ title: 'Qualcosa' }).success).toBe(false)
  })

  it('rejects an end before the start', () => {
    const result = createEventSchema.safeParse({
      title: 'Riunione',
      startsAt: '2026-09-06T10:00',
      endsAt: '2026-09-06T09:00',
    })

    expect(result.success).toBe(false)
  })

  it('accepts an end equal to the start, which is a zero-length marker', () => {
    const result = createEventSchema.safeParse({
      title: 'Scadenza',
      startsAt: '2026-09-06T10:00',
      endsAt: '2026-09-06T10:00',
    })

    expect(result.success).toBe(true)
  })

  it('refuses a start it cannot pin down', () => {
    expect(
      createEventSchema.safeParse({ title: 'X', startsAt: 'venerdì' }).success,
    ).toBe(false)
  })
})

describe('updateEventSchema', () => {
  it('still refuses to put the end before the start', () => {
    const result = updateEventSchema.safeParse({
      startsAt: '2026-09-06T10:00',
      endsAt: '2026-09-06T09:00',
    })
    expect(result.success).toBe(false)
  })
})

describe('createHabitSchema', () => {
  it('defaults to once a day', () => {
    const habit = createHabitSchema.parse({ name: 'Palestra' })

    expect(habit.frequency).toBe('daily')
    expect(habit.targetPerPeriod).toBe(1)
    expect(habit.daysOfWeek).toEqual([])
  })

  it('accepts chosen weekdays', () => {
    const habit = createHabitSchema.parse({
      name: 'Palestra',
      frequency: 'weekly',
      daysOfWeek: [1, 3, 5],
    })

    expect(habit.daysOfWeek).toEqual([1, 3, 5])
  })

  it('reads weekdays sent as strings by a form', () => {
    const habit = createHabitSchema.parse({
      name: 'Palestra',
      frequency: 'weekly',
      daysOfWeek: ['1', '3'],
    })

    expect(habit.daysOfWeek).toEqual([1, 3])
  })

  it.each([[[0]], [[8]], [[1, 1]]])('rejects a nonsensical weekday set %j', (daysOfWeek) => {
    expect(
      createHabitSchema.safeParse({ name: 'X', frequency: 'weekly', daysOfWeek }).success,
    ).toBe(false)
  })

  it('insists a weekly habit says which days', () => {
    // Otherwise there is no way to know whether a day was missed, and the
    // streak becomes meaningless.
    expect(
      createHabitSchema.safeParse({ name: 'X', frequency: 'weekly', daysOfWeek: [] }).success,
    ).toBe(false)
  })
})

describe('isScheduledOn', () => {
  const daily = { frequency: 'daily' as const, days_of_week: [] }
  // 2026-09-07 is a Monday.
  const monday = '2026-09-07'
  const tuesday = '2026-09-08'

  it('says a daily habit is due every day', () => {
    expect(isScheduledOn(daily, monday)).toBe(true)
    expect(isScheduledOn(daily, tuesday)).toBe(true)
  })

  it('says a weekly habit is due only on its days', () => {
    const monWedFri = { frequency: 'weekly' as const, days_of_week: [1, 3, 5] }

    expect(isScheduledOn(monWedFri, monday)).toBe(true)
    expect(isScheduledOn(monWedFri, tuesday)).toBe(false)
  })

  it('counts Sunday as 7, the way people number weekdays here', () => {
    const sundayOnly = { frequency: 'weekly' as const, days_of_week: [7] }
    expect(isScheduledOn(sundayOnly, '2026-09-13')).toBe(true) // domenica
    expect(isScheduledOn(sundayOnly, '2026-09-14')).toBe(false)
  })
})

describe('computeStreak', () => {
  const daily = { frequency: 'daily' as const, days_of_week: [] }
  const done = (date: string) => ({ entry_date: date, done: true })

  it('is zero with nothing recorded', () => {
    expect(computeStreak(daily, [], '2026-09-10')).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    const entries = [done('2026-09-08'), done('2026-09-09'), done('2026-09-10')]
    expect(computeStreak(daily, entries, '2026-09-10')).toBe(3)
  })

  it('survives today not being done yet', () => {
    // A streak that collapses at midnight and only returns in the evening
    // would punish you for not having done it at 00:01.
    const entries = [done('2026-09-08'), done('2026-09-09')]
    expect(computeStreak(daily, entries, '2026-09-10')).toBe(2)
  })

  it('breaks on a missed day', () => {
    const entries = [done('2026-09-07'), done('2026-09-09'), done('2026-09-10')]
    expect(computeStreak(daily, entries, '2026-09-10')).toBe(2)
  })

  it('is zero once two days have gone by', () => {
    const entries = [done('2026-09-07'), done('2026-09-08')]
    expect(computeStreak(daily, entries, '2026-09-10')).toBe(0)
  })

  it('ignores an entry explicitly marked as not done', () => {
    const entries = [done('2026-09-09'), { entry_date: '2026-09-10', done: false }]
    expect(computeStreak(daily, entries, '2026-09-10')).toBe(1)
  })

  it('skips unscheduled days for a weekly habit', () => {
    // Mon/Wed/Fri: doing it on Monday and Wednesday is a streak of two, and
    // the Tuesday in between is not a miss.
    const monWedFri = { frequency: 'weekly' as const, days_of_week: [1, 3, 5] }
    const entries = [done('2026-09-07'), done('2026-09-09')] // lunedì, mercoledì

    expect(computeStreak(monWedFri, entries, '2026-09-09')).toBe(2)
  })

  it('breaks a weekly streak on a skipped scheduled day', () => {
    const monWedFri = { frequency: 'weekly' as const, days_of_week: [1, 3, 5] }
    const entries = [done('2026-09-07'), done('2026-09-11')] // lunedì e venerdì, saltato mercoledì

    expect(computeStreak(monWedFri, entries, '2026-09-11')).toBe(1)
  })
})
