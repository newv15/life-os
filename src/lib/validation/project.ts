import { z } from 'zod'
import { PRIORITIES, PROJECT_STATUSES } from '@/lib/validation/enums'
import { calendarDate, calendarDatePatch, optionalText, text, uuid, uuidPatch } from '@/lib/validation/common'

const NAME_MAX = 120
const DESCRIPTION_MAX = 5000

/** A deadline before the start is a typo, not a plan. */
function checkDateOrder(
  data: { startedOn?: string | null; deadline?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.startedOn && data.deadline && data.deadline < data.startedOn) {
    ctx.addIssue({
      code: 'custom',
      path: ['deadline'],
      message: 'La scadenza non può precedere la data di inizio.',
    })
  }
}

export const createProjectSchema = z
  .object({
    name: text(NAME_MAX),
    description: optionalText(DESCRIPTION_MAX).default(null),
    status: z.enum(PROJECT_STATUSES).default('active'),
    priority: z.enum(PRIORITIES).default('medium'),
    startedOn: calendarDate,
    deadline: calendarDate,
    goalId: uuid,
  })
  .superRefine(checkDateOrder)

export const updateProjectSchema = z
  .object({
    name: text(NAME_MAX).optional(),
    description: optionalText(DESCRIPTION_MAX).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    startedOn: calendarDatePatch,
    deadline: calendarDatePatch,
    goalId: uuidPatch,
  })
  .superRefine(checkDateOrder)

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
