import { z } from 'zod'
import { parseAmount } from '@/lib/utils/currency'
import { resolveCalendarDate, todayISO } from '@/lib/utils/date'
import { TRANSACTION_TYPES } from '@/lib/validation/enums'
import { optionalText, uuid, uuidPatch } from '@/lib/validation/common'

const DESCRIPTION_MAX = 500

/**
 * An amount of money, from a person or from a model.
 *
 * parseAmount carries the separator rules; this adds the one thing the
 * database also insists on - the number is always positive. Direction lives in
 * `type`, never in the sign, so an expense and an income cannot end up being
 * distinguished by a minus sign that someone forgot to write.
 */
const amountValue = z.union([z.string(), z.number()]).transform((value, ctx): number => {
  try {
    const parsed = typeof value === 'number' ? value : parseAmount(value)
    if (!(parsed > 0)) {
      ctx.addIssue({ code: 'custom', message: "L'importo deve essere maggiore di zero." })
      return z.NEVER
    }
    return Math.round(parsed * 100) / 100
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Importo non riconosciuto.' })
    return z.NEVER
  }
})

/** A calendar day. Defaults to today as the user's clock sees it. */
const occurredOnValue = z
  .union([z.string(), z.null()])
  .nullish()
  .transform((value, ctx): string => {
    if (value == null || value.trim() === '') return todayISO()
    try {
      return resolveCalendarDate(value)
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Data non valida. Usa il formato 2026-09-04.' })
      return z.NEVER
    }
  })

const transactionFields = {
  type: z.enum(TRANSACTION_TYPES),
  accountId: z.uuid('Seleziona un conto.'),
  transferAccountId: uuid,
  amount: amountValue,
  categoryId: uuid,
  description: optionalText(DESCRIPTION_MAX).default(null),
  occurredOn: occurredOnValue,
  projectId: uuid,
  personId: uuid,
}

/**
 * A transfer is one row pointing at two accounts, so its shape has to be
 * checked as a whole rather than field by field. The same rule exists as a
 * check constraint in the database; this is the version that can say something
 * useful to the person who got it wrong.
 */
function checkTransferShape(
  data: { type: string; accountId: string; transferAccountId: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.type === 'transfer') {
    if (!data.transferAccountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['transferAccountId'],
        message: 'Scegli il conto di destinazione.',
      })
    } else if (data.transferAccountId === data.accountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['transferAccountId'],
        message: 'Il conto di destinazione deve essere diverso da quello di partenza.',
      })
    }
  } else if (data.transferAccountId) {
    ctx.addIssue({
      code: 'custom',
      path: ['transferAccountId'],
      message: 'Solo i trasferimenti hanno un conto di destinazione.',
    })
  }
}

export const createTransactionSchema = z
  .object(transactionFields)
  .superRefine(checkTransferShape)

export const updateTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES).optional(),
  accountId: z.uuid().optional(),
  transferAccountId: uuidPatch,
  amount: amountValue.optional(),
  categoryId: uuidPatch,
  description: optionalText(DESCRIPTION_MAX).optional(),
  occurredOn: occurredOnValue.optional(),
  projectId: uuidPatch,
  personId: uuidPatch,
})

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
