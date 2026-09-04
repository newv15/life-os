import { z } from 'zod'
import { PRIORITIES, TASK_STATUSES } from '@/lib/validation/enums'
import {
  instant,
  instantPatch,
  optionalText,
  positiveInt,
  positiveIntPatch,
  text,
  uuid,
  uuidPatch,
} from '@/lib/validation/common'

/**
 * A deliberately reduced recurrence model, not RRULE.
 *
 * Full RRULE is a large surface with subtle bugs, and nothing in a personal
 * system needs "the third Tuesday except in leap years". Daily, weekly with
 * chosen weekdays, and monthly cover it.
 */
export const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly']),
  interval: z.number().int().positive().max(52).default(1),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).default([]),
})

export type Recurrence = z.infer<typeof recurrenceSchema>

/** Longer than this is a description, not a title. */
const TITLE_MAX = 200
const DESCRIPTION_MAX = 5000

export const createTaskSchema = z.object({
  title: text(TITLE_MAX),
  description: optionalText(DESCRIPTION_MAX).default(null),
  status: z.enum(TASK_STATUSES).default('todo'),
  priority: z.enum(PRIORITIES).default('medium'),
  categoryId: uuid,
  projectId: uuid,
  goalId: uuid,
  dueAt: instant,
  estimatedMinutes: positiveInt,
  recurrence: recurrenceSchema.nullish().transform((v) => v ?? null),
})

export const updateTaskSchema = z.object({
  title: text(TITLE_MAX).optional(),
  description: optionalText(DESCRIPTION_MAX).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  categoryId: uuidPatch,
  projectId: uuidPatch,
  goalId: uuidPatch,
  dueAt: instantPatch,
  estimatedMinutes: positiveIntPatch,
  recurrence: recurrenceSchema.nullable().optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
