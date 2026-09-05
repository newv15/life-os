import { z } from 'zod'
import { instant, instantPatch, optionalText, text, uuid, uuidPatch } from '@/lib/validation/common'

const TITLE_MAX = 200
const DESCRIPTION_MAX = 5000
const LOCATION_MAX = 200

/** An end before its start is a typo, and the database rejects it anyway. */
function checkOrder(
  data: { startsAt?: Date | null; endsAt?: Date | null },
  ctx: z.RefinementCtx,
) {
  if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['endsAt'],
      message: "La fine non può precedere l'inizio.",
    })
  }
}

export const createEventSchema = z
  .object({
    title: text(TITLE_MAX),
    description: optionalText(DESCRIPTION_MAX).default(null),
    // The one required instant in the system: an event without a moment is a
    // task, and belongs in the other module.
    startsAt: instant.refine((value): value is Date => value !== null, {
      message: "Serve una data e un'ora di inizio.",
    }),
    endsAt: instant,
    allDay: z.coerce.boolean().default(false),
    location: optionalText(LOCATION_MAX).default(null),
    projectId: uuid,
    personId: uuid,
  })
  .superRefine(checkOrder)

export const updateEventSchema = z
  .object({
    title: text(TITLE_MAX).optional(),
    description: optionalText(DESCRIPTION_MAX).optional(),
    startsAt: instantPatch,
    endsAt: instantPatch,
    allDay: z.coerce.boolean().optional(),
    location: optionalText(LOCATION_MAX).optional(),
    projectId: uuidPatch,
    personId: uuidPatch,
  })
  .superRefine(checkOrder)

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
