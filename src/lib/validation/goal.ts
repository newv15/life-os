import { z } from 'zod'
import { GOAL_HORIZONS, GOAL_STATUSES } from '@/lib/validation/enums'
import {
  calendarDate,
  calendarDatePatch,
  decimal,
  decimalPatch,
  optionalText,
  text,
  uuid,
  uuidPatch,
} from '@/lib/validation/common'

const TITLE_MAX = 200
const DESCRIPTION_MAX = 5000
const UNIT_MAX = 30

/**
 * Goals come in two shapes and the schema has to hold both.
 *
 * A numeric goal - "put aside 10.000 euro" - tracks a value against a target.
 * A qualitative one - "read more" - has no number at all and is driven by its
 * milestones. So targetValue stays optional, and currentValue simply starts at
 * zero rather than being required.
 */
export const createGoalSchema = z.object({
  title: text(TITLE_MAX),
  description: optionalText(DESCRIPTION_MAX).default(null),
  horizon: z.enum(GOAL_HORIZONS),
  status: z.enum(GOAL_STATUSES).default('active'),
  parentGoalId: uuid,
  metricUnit: optionalText(UNIT_MAX).default(null),
  startValue: decimal.transform((v) => v ?? 0),
  targetValue: decimal,
  currentValue: decimal.transform((v) => v ?? 0),
  deadline: calendarDate,
})

export const updateGoalSchema = z.object({
  title: text(TITLE_MAX).optional(),
  description: optionalText(DESCRIPTION_MAX).optional(),
  horizon: z.enum(GOAL_HORIZONS).optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  parentGoalId: uuidPatch,
  metricUnit: optionalText(UNIT_MAX).optional(),
  startValue: decimalPatch,
  targetValue: decimalPatch,
  currentValue: decimalPatch,
  deadline: calendarDatePatch,
})

export type CreateGoalInput = z.infer<typeof createGoalSchema>
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>

/**
 * How far along a goal is, as a percentage.
 *
 * Measured from where it started, not from zero: a savings goal that began at
 * 2.000 and aims at 10.000 is not already 20% done. Returns null when there is
 * no target to measure against, so the UI can show milestones instead of a
 * meaningless bar.
 */
export function goalProgress(goal: {
  start_value: number | string
  current_value: number | string
  target_value: number | string | null
}): number | null {
  if (goal.target_value === null) return null

  const start = Number(goal.start_value)
  const current = Number(goal.current_value)
  const target = Number(goal.target_value)
  const span = target - start

  if (span === 0) return current >= target ? 100 : 0

  const percent = ((current - start) / span) * 100
  return Math.max(0, Math.min(100, Math.round(percent)))
}
