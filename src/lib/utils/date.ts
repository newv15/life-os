import { it } from 'date-fns/locale'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'

/**
 * Date handling for the whole app.
 *
 * This module carries more weight than its size suggests. The single most
 * damaging failure mode of a natural-language life OS is a reminder that fires
 * on the wrong day: get "venerdi" wrong once and the system stops being
 * trusted. So the rule is:
 *
 *   the model never computes a date - it only reports one, and this module
 *   decides what that means.
 *
 * The model is given the current instant in the user's timezone and must answer
 * with an explicit calendar value. Anything it cannot pin down is a question to
 * the user, never a guess.
 *
 * Instants are stored as timestamptz (UTC). Wall-clock meaning is applied only
 * at the edges: here on the way in, and in formatting on the way out.
 */

export const DEFAULT_TIMEZONE = 'Europe/Rome'

/** ISO date only: 2026-09-04 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
/** Local wall clock, no zone: 2026-09-04T10:00 or 2026-09-04T10:00:00 */
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/
/** Absolute instant carrying its own offset: ...Z or ...+02:00 */
const ZONED_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

export class InvalidDateError extends Error {
  constructor(value: string) {
    super(`Data non interpretabile: "${value}"`)
    this.name = 'InvalidDateError'
  }
}

/** The current instant, as the user's wall clock sees it. */
export function nowInTimeZone(timeZone: string = DEFAULT_TIMEZONE): Date {
  return toZonedTime(new Date(), timeZone)
}

/** Today's calendar date in the user's timezone, as YYYY-MM-DD. */
export function todayISO(timeZone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd')
}

/**
 * Turns whatever the model reported into a real instant.
 *
 * - `2026-09-04T08:00:00Z` is already absolute and is taken as-is.
 * - `2026-09-04T10:00` is a wall clock and means 10:00 *for the user*, which is
 *   the only reading that survives a DST change.
 * - `2026-09-04` means the start of that day in the user's timezone.
 *
 * Anything else throws rather than being coerced into a plausible-looking wrong
 * answer.
 */
export function resolveInstant(value: string, timeZone: string = DEFAULT_TIMEZONE): Date {
  const raw = value.trim()

  if (ZONED_DATE_TIME.test(raw)) {
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) throw new InvalidDateError(value)
    return parsed
  }

  if (LOCAL_DATE_TIME.test(raw) || DATE_ONLY.test(raw)) {
    const wallClock = DATE_ONLY.test(raw) ? `${raw}T00:00:00` : normaliseSeconds(raw)
    const parsed = fromZonedTime(wallClock, timeZone)
    if (Number.isNaN(parsed.getTime())) throw new InvalidDateError(value)
    return parsed
  }

  throw new InvalidDateError(value)
}

/**
 * Validates a calendar date (no time component) reported by the model.
 * Returns it unchanged as YYYY-MM-DD, which is what `date` columns store.
 */
export function resolveCalendarDate(value: string): string {
  const raw = value.trim()
  if (!DATE_ONLY.test(raw)) throw new InvalidDateError(value)

  const [year, month, day] = raw.split('-').map(Number)
  const probe = new Date(Date.UTC(year, month - 1, day))
  // Rejects 2026-02-30 and friends, which pass the regex but are not real days.
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new InvalidDateError(value)
  }
  return raw
}

/** First instant of the given calendar day, in the user's timezone. */
export function startOfDayInTimeZone(
  isoDate: string,
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  return fromZonedTime(`${resolveCalendarDate(isoDate)}T00:00:00`, timeZone)
}

/** First instant of the following day - use as an exclusive upper bound. */
export function endOfDayInTimeZone(
  isoDate: string,
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  const start = startOfDayInTimeZone(isoDate, timeZone)
  const nextDay = formatInTimeZone(
    new Date(start.getTime() + 36 * 60 * 60 * 1000),
    timeZone,
    'yyyy-MM-dd',
  )
  return startOfDayInTimeZone(nextDay, timeZone)
}

// --- Formatting (Italian) ----------------------------------------------------

export function formatDate(date: Date | string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(new Date(date), timeZone, 'dd/MM/yyyy')
}

export function formatTime(date: Date | string, timeZone: string = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(new Date(date), timeZone, 'HH:mm')
}

export function formatDateTime(
  date: Date | string,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(new Date(date), timeZone, 'dd/MM/yyyy HH:mm')
}

/**
 * Names a day the way a person reading a list would: "oggi", "domani",
 * "ieri", and a bare date once the day has no name.
 *
 * The comparison happens on the local calendar date, not on elapsed hours: a
 * deadline at 00:30 Rome time is 22:30Z the previous day, and calling that
 * "oggi" because UTC says so is exactly the kind of small lie that makes a
 * list stop being trustworthy.
 */
export function formatRelativeDay(
  date: Date | string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const target = formatInTimeZone(new Date(date), timeZone, 'yyyy-MM-dd')
  const today = formatInTimeZone(now, timeZone, 'yyyy-MM-dd')

  if (target === today) return 'oggi'
  if (target === shiftDays(today, 1, timeZone)) return 'domani'
  if (target === shiftDays(today, -1, timeZone)) return 'ieri'

  return formatInTimeZone(new Date(date), timeZone, 'dd/MM')
}

/** True when the moment has already passed. A missing deadline is never late. */
export function isOverdue(date: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!date) return false
  return new Date(date).getTime() < now.getTime()
}

/**
 * The calendar month a moment falls in, as inclusive YYYY-MM-DD bounds.
 *
 * Uses the local month for the same reason as everything else here: at 00:30
 * on the first of the month, UTC is still in the previous one, and the
 * dashboard would open on a month the user has already left.
 */
export function monthRange(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): { from: string; to: string } {
  const year = Number(formatInTimeZone(date, timeZone, 'yyyy'))
  const month = Number(formatInTimeZone(date, timeZone, 'MM'))

  // Day 0 of the next month is the last day of this one, leap years included.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')

  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  }
}

/** Moves a calendar date by whole days, going through noon to dodge DST. */
function shiftDays(isoDate: string, days: number, timeZone: string): string {
  const noon = fromZonedTime(`${isoDate}T12:00:00`, timeZone)
  const shifted = new Date(noon.getTime() + days * 24 * 60 * 60 * 1000)
  return formatInTimeZone(shifted, timeZone, 'yyyy-MM-dd')
}

/** "giovedì 4 settembre" - the date as a person would say it out loud. */
export function formatLongDate(
  date: Date | string = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(new Date(date), timeZone, 'EEEE d MMMM', { locale: it })
}

/**
 * The "now" line handed to the model on every request, so it never has to
 * infer today's date from training data.
 */
export function describeNowForPrompt(timeZone: string = DEFAULT_TIMEZONE): string {
  const now = new Date()
  const weekday = formatInTimeZone(now, timeZone, 'EEEE')
  const iso = formatInTimeZone(now, timeZone, "yyyy-MM-dd'T'HH:mmXXX")
  return `${ITALIAN_WEEKDAYS[weekday] ?? weekday} ${iso} (fuso orario ${timeZone})`
}

const ITALIAN_WEEKDAYS: Record<string, string> = {
  Monday: 'lunedi',
  Tuesday: 'martedi',
  Wednesday: 'mercoledi',
  Thursday: 'giovedi',
  Friday: 'venerdi',
  Saturday: 'sabato',
  Sunday: 'domenica',
}

function normaliseSeconds(value: string): string {
  return value.length === 16 ? `${value}:00` : value
}
