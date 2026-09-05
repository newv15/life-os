import { z } from 'zod'
import { optionalText, positiveInt, text, uuid, uuidPatch } from '@/lib/validation/common'
import { HABIT_FREQUENCIES } from '@/lib/validation/enums'

const NAME_MAX = 120
const DESCRIPTION_MAX = 2000

/** ISO weekday numbers: 1 is Monday and 7 is Sunday, as people count here. */
const weekdays = z
  .array(z.coerce.number().int().min(1).max(7))
  .max(7)
  .refine((days) => new Set(days).size === days.length, {
    message: 'Ogni giorno può comparire una sola volta.',
  })
  .default([])

/**
 * A weekly habit has to say which days.
 *
 * Without them there is no way to know whether a day was missed, and a streak
 * that cannot tell a rest day from a skipped one is worse than no streak.
 */
function checkWeeklyHasDays(
  data: { frequency?: string; daysOfWeek?: number[] },
  ctx: z.RefinementCtx,
) {
  if (data.frequency === 'weekly' && (data.daysOfWeek?.length ?? 0) === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['daysOfWeek'],
      message: 'Scegli in quali giorni della settimana.',
    })
  }
}

export const createHabitSchema = z
  .object({
    name: text(NAME_MAX),
    description: optionalText(DESCRIPTION_MAX).default(null),
    frequency: z.enum(HABIT_FREQUENCIES).default('daily'),
    targetPerPeriod: positiveInt.transform((value) => value ?? 1),
    daysOfWeek: weekdays,
    goalId: uuid,
  })
  .superRefine(checkWeeklyHasDays)

export const updateHabitSchema = z
  .object({
    name: text(NAME_MAX).optional(),
    description: optionalText(DESCRIPTION_MAX).optional(),
    frequency: z.enum(HABIT_FREQUENCIES).optional(),
    targetPerPeriod: positiveInt.optional(),
    daysOfWeek: weekdays.optional(),
    goalId: uuidPatch,
    active: z.coerce.boolean().optional(),
  })
  .superRefine(checkWeeklyHasDays)

export type CreateHabitInput = z.infer<typeof createHabitSchema>
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>

// --- Streaks -----------------------------------------------------------------

type Schedule = { frequency: string; days_of_week: number[] | null }
type Entry = { entry_date: string; done: boolean }

/** ISO weekday of a YYYY-MM-DD, counting Monday as 1 and Sunday as 7. */
function isoWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

function shiftDay(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

/** Whether the habit was supposed to happen on that day at all. */
export function isScheduledOn(habit: Schedule, isoDate: string): boolean {
  if (habit.frequency === 'daily') return true

  const days = habit.days_of_week ?? []
  if (days.length === 0) return true

  return days.includes(isoWeekday(isoDate))
}

/**
 * How many scheduled days in a row have been kept, counting back from today.
 *
 * Two decisions worth stating. Days the habit was never due are skipped rather
 * than counted as misses - otherwise a Mon/Wed/Fri habit could never hold a
 * streak past Tuesday. And today not being done yet does not break anything:
 * a streak that collapses at midnight and returns in the evening punishes you
 * for not having done it at 00:01.
 */
export function computeStreak(habit: Schedule, entries: Entry[], today: string): number {
  const kept = new Set(entries.filter((entry) => entry.done).map((entry) => entry.entry_date))

  let streak = 0
  let cursor = today
  let firstScheduledDay = true

  // A year back is far more than any streak worth displaying.
  for (let step = 0; step < 400; step += 1) {
    if (isScheduledOn(habit, cursor)) {
      if (kept.has(cursor)) {
        streak += 1
      } else if (firstScheduledDay) {
        // Today is still open: not doing it yet is not a miss.
        firstScheduledDay = false
      } else {
        break
      }
      firstScheduledDay = false
    }

    cursor = shiftDay(cursor, -1)
  }

  return streak
}
