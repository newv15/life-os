import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIMEZONE,
  InvalidDateError,
  endOfDayInTimeZone,
  formatDateTime,
  formatRelativeDay,
  isOverdue,
  resolveCalendarDate,
  resolveInstant,
  startOfDayInTimeZone,
} from '@/lib/utils/date'

/**
 * These tests exist because a reminder on the wrong day is the failure that
 * makes the whole system untrustworthy. Every case here is one the AI can
 * plausibly produce.
 */

describe('resolveInstant', () => {
  it('reads a bare wall clock as local time during summer time (CEST, +02:00)', () => {
    expect(resolveInstant('2026-09-04T10:00').toISOString()).toBe('2026-09-04T08:00:00.000Z')
  })

  it('reads the same wall clock differently during winter time (CET, +01:00)', () => {
    expect(resolveInstant('2026-01-15T10:00').toISOString()).toBe('2026-01-15T09:00:00.000Z')
  })

  it('accepts seconds in the wall clock form', () => {
    expect(resolveInstant('2026-09-04T10:00:30').toISOString()).toBe('2026-09-04T08:00:30.000Z')
  })

  it('takes an already absolute instant as-is', () => {
    expect(resolveInstant('2026-09-04T08:00:00Z').toISOString()).toBe('2026-09-04T08:00:00.000Z')
  })

  it('honours an explicit offset that differs from the app timezone', () => {
    expect(resolveInstant('2026-09-04T10:00:00+00:00').toISOString()).toBe(
      '2026-09-04T10:00:00.000Z',
    )
  })

  it('treats a date with no time as the start of that day locally', () => {
    expect(resolveInstant('2026-09-04').toISOString()).toBe('2026-09-03T22:00:00.000Z')
  })

  it('respects a caller-supplied timezone', () => {
    expect(resolveInstant('2026-09-04T10:00', 'UTC').toISOString()).toBe(
      '2026-09-04T10:00:00.000Z',
    )
  })

  it.each(['domani', 'venerdi prossimo', '04/09/2026', '2026-9-4', '', 'next friday'])(
    'refuses to guess at %j instead of inventing a date',
    (input) => {
      expect(() => resolveInstant(input)).toThrow(InvalidDateError)
    },
  )
})

describe('resolveCalendarDate', () => {
  it('passes a real date through unchanged', () => {
    expect(resolveCalendarDate('2026-02-28')).toBe('2026-02-28')
  })

  it('accepts the leap day of a leap year', () => {
    expect(resolveCalendarDate('2028-02-29')).toBe('2028-02-29')
  })

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2026-02-29', '04/09/2026'])(
    'rejects %j',
    (input) => {
      expect(() => resolveCalendarDate(input)).toThrow(InvalidDateError)
    },
  )
})

describe('day boundaries across DST', () => {
  const hours = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 3_600_000

  it('spans 24 hours on an ordinary day', () => {
    const start = startOfDayInTimeZone('2026-09-04')
    expect(hours(start, endOfDayInTimeZone('2026-09-04'))).toBe(24)
  })

  it('spans 23 hours on the day clocks move forward', () => {
    // Last Sunday of March 2026: 02:00 becomes 03:00.
    const start = startOfDayInTimeZone('2026-03-29')
    expect(hours(start, endOfDayInTimeZone('2026-03-29'))).toBe(23)
  })

  it('spans 25 hours on the day clocks move back', () => {
    // Last Sunday of October 2026: 03:00 becomes 02:00.
    const start = startOfDayInTimeZone('2026-10-25')
    expect(hours(start, endOfDayInTimeZone('2026-10-25'))).toBe(25)
  })
})

describe('relative day naming', () => {
  // A fixed "now" so these read the same in July as in January.
  const now = new Date('2026-09-04T09:00:00Z') // 11:00 a Roma

  it('names today, tomorrow and yesterday the way a person would', () => {
    expect(formatRelativeDay('2026-09-04T16:00:00Z', now)).toBe('oggi')
    expect(formatRelativeDay('2026-09-05T08:00:00Z', now)).toBe('domani')
    expect(formatRelativeDay('2026-09-03T08:00:00Z', now)).toBe('ieri')
  })

  it('falls back to a date once the day has no name', () => {
    expect(formatRelativeDay('2026-09-09T08:00:00Z', now)).toBe('09/09')
  })

  it('judges the day by the local clock, not by UTC', () => {
    // 23:30 in Rome is still 21:30Z the same day, but 00:30 in Rome is
    // 22:30Z the day BEFORE - which UTC would call today and the user
    // would call tomorrow.
    expect(formatRelativeDay('2026-09-04T22:30:00Z', now)).toBe('domani')
  })

  it('knows whether a moment has already passed', () => {
    expect(isOverdue('2026-09-04T08:59:00Z', now)).toBe(true)
    expect(isOverdue('2026-09-04T09:01:00Z', now)).toBe(false)
    expect(isOverdue(null, now)).toBe(false)
  })
})

describe('formatting', () => {
  it('renders instants in Italian order in the app timezone', () => {
    expect(formatDateTime('2026-09-04T08:00:00Z')).toBe('04/09/2026 10:00')
  })

  it('defaults to Europe/Rome', () => {
    expect(DEFAULT_TIMEZONE).toBe('Europe/Rome')
  })
})
