import { NotFoundError, parseOrThrow } from '@/lib/services/errors'
import {
  deleteHabitRow,
  insertHabit,
  selectHabitById,
  selectHabitEntries,
  selectHabits,
  updateHabitRow,
  upsertHabitEntry,
  type HabitEntryRow,
  type HabitRow,
} from '@/lib/db/repositories/habits'
import { computeStreak, createHabitSchema, isScheduledOn, updateHabitSchema } from '@/lib/validation/habit'
import { todayISO } from '@/lib/utils/date'
import type { Db, Enums } from '@/lib/db/types'

export type { HabitRow, HabitEntryRow }

/** A habit with the two things a person actually looks at. */
export type HabitWithProgress = HabitRow & {
  streak: number
  doneToday: boolean
  dueToday: boolean
  /** Kept days out of scheduled days over the last month, as a percentage. */
  consistency: number
}

export async function createHabit(
  db: Db,
  userId: string,
  input: unknown,
  createdVia: Enums['created_via'] = 'web',
): Promise<HabitRow> {
  const data = parseOrThrow(createHabitSchema, input)

  return insertHabit(db, userId, {
    name: data.name,
    description: data.description,
    frequency: data.frequency,
    target_per_period: data.targetPerPeriod,
    days_of_week: data.daysOfWeek,
    goal_id: data.goalId,
    created_via: createdVia,
  })
}

/**
 * Every habit, with its streak worked out.
 *
 * One query for the habits and one for the last few months of entries, then
 * the arithmetic happens here: a streak per habit computed in SQL would be a
 * window function nobody could read, over a handful of rows.
 */
export async function listHabits(
  db: Db,
  userId: string,
  timezone?: string,
): Promise<HabitWithProgress[]> {
  const today = todayISO(timezone)
  const [habits, entries] = await Promise.all([
    selectHabits(db, userId),
    selectHabitEntries(db, userId, { from: shift(today, -120) }),
  ])

  const byHabit = new Map<string, HabitEntryRow[]>()
  for (const entry of entries) {
    const list = byHabit.get(entry.habit_id) ?? []
    list.push(entry)
    byHabit.set(entry.habit_id, list)
  }

  return habits.map((habit) => {
    const own = byHabit.get(habit.id) ?? []

    return {
      ...habit,
      streak: computeStreak(habit, own, today),
      doneToday: own.some((entry) => entry.entry_date === today && entry.done),
      dueToday: isScheduledOn(habit, today),
      consistency: consistencyOver(habit, own, today, 30),
    }
  })
}

export async function getHabit(db: Db, userId: string, id: string): Promise<HabitRow | null> {
  return selectHabitById(db, userId, id)
}

export async function updateHabit(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
): Promise<HabitRow> {
  const data = parseOrThrow(updateHabitSchema, input)

  const patch: Parameters<typeof updateHabitRow>[3] = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.description !== undefined) patch.description = data.description
  if (data.frequency !== undefined) patch.frequency = data.frequency
  if (data.targetPerPeriod !== undefined) patch.target_per_period = data.targetPerPeriod ?? 1
  if (data.daysOfWeek !== undefined) patch.days_of_week = data.daysOfWeek
  if (data.goalId !== undefined) patch.goal_id = data.goalId
  if (data.active !== undefined) patch.active = data.active

  const updated = await updateHabitRow(db, userId, id, patch)
  if (!updated) throw new NotFoundError('Abitudine non trovata.')
  return updated
}

export async function deleteHabit(db: Db, userId: string, id: string): Promise<void> {
  await deleteHabitRow(db, userId, id)
}

/**
 * Marks a day, or unmarks it.
 *
 * Idempotent by design: tapping twice is how a mistake gets undone, so this
 * writes the state asked for rather than toggling whatever was there.
 */
export async function recordHabit(
  db: Db,
  userId: string,
  habitId: string,
  options: { date?: string; done?: boolean; timezone?: string } = {},
): Promise<HabitEntryRow> {
  const habit = await selectHabitById(db, userId, habitId)
  if (!habit) throw new NotFoundError('Abitudine non trovata.')

  return upsertHabitEntry(db, userId, {
    habit_id: habitId,
    entry_date: options.date ?? todayISO(options.timezone),
    done: options.done ?? true,
  })
}

export async function listHabitEntries(
  db: Db,
  userId: string,
  options: { from?: string; to?: string } = {},
): Promise<HabitEntryRow[]> {
  return selectHabitEntries(db, userId, options)
}

/** Kept days over scheduled days in the window - 100 when nothing was due. */
function consistencyOver(
  habit: HabitRow,
  entries: HabitEntryRow[],
  today: string,
  days: number,
): number {
  const kept = new Set(entries.filter((entry) => entry.done).map((entry) => entry.entry_date))

  let scheduled = 0
  let done = 0

  for (let offset = 0; offset < days; offset += 1) {
    const day = shift(today, -offset)
    if (!isScheduledOn(habit, day)) continue

    scheduled += 1
    if (kept.has(day)) done += 1
  }

  return scheduled === 0 ? 100 : Math.round((done / scheduled) * 100)
}

function shift(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}
