import { z } from 'zod'
import { resolveInstant } from '@/lib/utils/date'

/**
 * Shared field builders.
 *
 * Input reaches these from two very different places: a web form, where every
 * value is a string and an untouched field is `''`, and the AI tool registry,
 * where values are already typed JSON. Both go through the same builders, so a
 * rule written once holds for the form and the bot alike.
 *
 * The convention throughout: `''` means "not filled in", and becomes null. It
 * never becomes 0, and it is never an error.
 */

const BLANK = ''

/** Free text with a length ceiling. Trimmed first, so "   " is empty. */
export function text(max: number) {
  return z.string().trim().min(1, 'Campo obbligatorio.').max(max, `Massimo ${max} caratteri.`)
}

/** Optional free text: blank becomes null rather than an empty string row. */
export function optionalText(max: number) {
  return z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null
      const trimmed = value.trim()
      return trimmed === BLANK ? null : trimmed
    })
    .pipe(z.string().max(max, `Massimo ${max} caratteri.`).nullable())
}

/**
 * An instant, from whatever the caller had.
 *
 * The heavy lifting is in resolveInstant: a bare wall clock is read in the
 * user's timezone, and anything ambiguous throws instead of being coerced. A
 * due date the system cannot pin down must stop here, not become a reminder
 * that fires on the wrong day.
 */
const instantValue = z
  .union([z.string(), z.date(), z.null()])
  .transform((value, ctx): Date | null => {
    if (value === null) return null
    if (value instanceof Date) return value
    if (value.trim() === BLANK) return null

    try {
      return resolveInstant(value)
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Data non riconosciuta. Usa una data assoluta, ad esempio 2026-09-05T10:00.',
      })
      return z.NEVER
    }
  })

/** For creation: an absent value means "no date". */
export const instant = instantValue.nullish().transform((v) => v ?? null)

/** For updates: absent leaves the field alone, `''` clears it. */
export const instantPatch = instantValue.optional()

/** A foreign key. Blank means "not linked", a malformed id is an error. */
const uuidValue = z.union([z.string(), z.null()]).transform((value, ctx): string | null => {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed === BLANK) return null

  if (!z.uuid().safeParse(trimmed).success) {
    ctx.addIssue({ code: 'custom', message: 'Identificativo non valido.' })
    return z.NEVER
  }
  return trimmed
})

export const uuid = uuidValue.nullish().transform((v) => v ?? null)
export const uuidPatch = uuidValue.optional()

/** A count of whole units - minutes, quantities. Blank is absent, not zero. */
const positiveIntValue = z
  .union([z.string(), z.number(), z.null()])
  .transform((value, ctx): number | null => {
    if (value === null) return null

    let parsed: number
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === BLANK) return null
      parsed = Number(trimmed)
    } else {
      parsed = value
    }

    if (!Number.isInteger(parsed) || parsed <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Inserisci un numero intero maggiore di zero.' })
      return z.NEVER
    }
    return parsed
  })

export const positiveInt = positiveIntValue.nullish().transform((v) => v ?? null)
export const positiveIntPatch = positiveIntValue.optional()
