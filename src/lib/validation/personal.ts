import { z } from 'zod'
import {
  calendarDate,
  calendarDatePatch,
  instant,
  instantPatch,
  optionalText,
  text,
  uuid,
  uuidPatch,
} from '@/lib/validation/common'

// --- Journal -----------------------------------------------------------------

const BODY_MAX = 20_000
const FIELD_MAX = 5_000

/** One to five. Anything finer is a number nobody can answer honestly. */
const rating = z
  .union([z.string(), z.number(), z.null()])
  .nullish()
  .transform((value, ctx): number | null => {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return null

    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      ctx.addIssue({ code: 'custom', message: 'Indica un valore da 1 a 5.' })
      return z.NEVER
    }
    return parsed
  })

export const journalEntrySchema = z.object({
  entryDate: calendarDate,
  body: optionalText(BODY_MAX).default(null),
  energy: rating,
  mood: rating,
  wins: optionalText(FIELD_MAX).default(null),
  blockers: optionalText(FIELD_MAX).default(null),
  reflections: optionalText(FIELD_MAX).default(null),
  nextGoals: optionalText(FIELD_MAX).default(null),
})

export type JournalEntryInput = z.infer<typeof journalEntrySchema>

// --- People ------------------------------------------------------------------

const NAME_MAX = 150
const SHORT_MAX = 120

export const createPersonSchema = z.object({
  fullName: text(NAME_MAX),
  relationship: optionalText(SHORT_MAX).default(null),
  company: optionalText(SHORT_MAX).default(null),
  role: optionalText(SHORT_MAX).default(null),
  // Deliberately not validated as an address: a contact card holds whatever
  // you actually have, and rejecting "marco (quello del lavoro)" helps nobody.
  email: optionalText(SHORT_MAX).default(null),
  phone: optionalText(SHORT_MAX).default(null),
  notes: optionalText(FIELD_MAX).default(null),
  nextAction: optionalText(SHORT_MAX).default(null),
  nextActionAt: instant,
  lastInteractionAt: instant,
})

export const updatePersonSchema = z.object({
  fullName: text(NAME_MAX).optional(),
  relationship: optionalText(SHORT_MAX).optional(),
  company: optionalText(SHORT_MAX).optional(),
  role: optionalText(SHORT_MAX).optional(),
  email: optionalText(SHORT_MAX).optional(),
  phone: optionalText(SHORT_MAX).optional(),
  notes: optionalText(FIELD_MAX).optional(),
  nextAction: optionalText(SHORT_MAX).optional(),
  nextActionAt: instantPatch,
  lastInteractionAt: instantPatch,
})

export type CreatePersonInput = z.infer<typeof createPersonSchema>
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>

// --- Time tracking -----------------------------------------------------------

export const startTimerSchema = z.object({
  taskId: uuid,
  projectId: uuid,
  categoryId: uuid,
  note: optionalText(SHORT_MAX).default(null),
  startedAt: instant,
})

export const updateTimeEntrySchema = z.object({
  taskId: uuidPatch,
  projectId: uuidPatch,
  categoryId: uuidPatch,
  note: optionalText(SHORT_MAX).optional(),
  startedAt: instantPatch,
  endedAt: instantPatch,
})

export type StartTimerInput = z.infer<typeof startTimerSchema>

// Re-exported so callers building journal filters share the same date rules.
export { calendarDate, calendarDatePatch }
