import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIMEZONE,
  InvalidDateError,
  endOfDayInTimeZone,
  formatDateTime,
  daysAgo,
  formatRelativeDay,
  isOverdue,
  monthRange,
  resolveCalendarDate,
  resolveInstant,
  startOfDayInTimeZone,
  formatMonthKey,
  monthKeyOf,
  monthRangeFromKey,
  shiftMonthKey,
  toDateTimeLocal,
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

describe('monthRange', () => {
  it('covers the whole month the given day falls in', () => {
    expect(monthRange(new Date('2026-09-15T12:00:00Z'))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
  })

  it('gets February right in a leap year', () => {
    expect(monthRange(new Date('2028-02-10T12:00:00Z'))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
  })

  it('uses the local month, not the UTC one', () => {
    // 00:30 on 1 October in Rome is 22:30Z on 30 September. The month the
    // person is in is October.
    expect(monthRange(new Date('2026-09-30T22:30:00Z'))).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    })
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

describe('daysAgo', () => {
  const now = new Date('2026-09-05T14:00:00Z')

  it('goes back whole days from the given moment', () => {
    expect(daysAgo(7, now).toISOString()).toBe('2026-08-29T14:00:00.000Z')
  })

  it('accepts zero as now', () => {
    expect(daysAgo(0, now).toISOString()).toBe(now.toISOString())
  })

  it('crosses a daylight saving change without drifting', () => {
    // 25 October 2026 is when the clocks go back. Counting in whole days of
    // 24 hours is what a "last 7 days" window means, and this pins it.
    const afterChange = new Date('2026-10-28T12:00:00Z')
    expect(daysAgo(7, afterChange).toISOString()).toBe('2026-10-21T12:00:00.000Z')
  })
})

describe('toDateTimeLocal', () => {
  /**
   * The value a datetime-local input wants is a wall clock with no zone, read
   * in the person's timezone. Slicing the stored instant instead would show
   * UTC - two hours early in summer here - and, worse, saving the form
   * unchanged would silently move the task by those two hours.
   */
  it('shows the stored instant as the clock the person reads', () => {
    expect(toDateTimeLocal('2026-09-06T18:23:00+00:00')).toBe('2026-09-06T20:23')
  })

  it('gets the offset right in winter too', () => {
    expect(toDateTimeLocal('2026-01-15T18:23:00Z')).toBe('2026-01-15T19:23')
  })

  it('gives an empty field for a task with no deadline', () => {
    expect(toDateTimeLocal(null)).toBe('')
  })
})

describe('i mesi come chiave', () => {
  it('torna indietro attraverso il capodanno', () => {
    // Il caso che un mese = -1 sul numero sbaglia sempre.
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
  })

  it('va avanti attraverso il capodanno', () => {
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01')
  })

  it('resta nello stesso anno quando non serve saltare', () => {
    expect(shiftMonthKey('2026-09', -1)).toBe('2026-08')
  })

  it('conosce la lunghezza di febbraio, bisestile compreso', () => {
    expect(monthRangeFromKey('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(monthRangeFromKey('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('copre il mese intero, non trenta giorni a caso', () => {
    expect(monthRangeFromKey('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('lo scrive come lo direbbe una persona', () => {
    expect(formatMonthKey('2026-09')).toBe('settembre 2026')
  })

  it('ricava la chiave da un istante, nel fuso di casa', () => {
    // Mezzanotte e mezza del primo settembre a Roma è ancora agosto a Londra:
    // leggerlo in UTC metterebbe il movimento nel mese sbagliato.
    expect(monthKeyOf(new Date('2026-09-01T00:30:00+02:00'))).toBe('2026-09')
  })
})
