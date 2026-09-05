import { z } from 'zod'
import { ValidationError } from '@/lib/services/errors'
import { matchByName } from '@/lib/ai/tools/resolve'

/**
 * Parameter fragments shared across tools.
 *
 * The wording of these descriptions is load-bearing: it is the only place the
 * model is told what shape an answer takes, and a vague description is how a
 * reminder ends up on the wrong day.
 */

/**
 * The rule that keeps dates honest.
 *
 * The model is handed the current instant in the user's timezone and must
 * return an absolute value. It is told in as many words not to write "domani",
 * because the validation layer rejects it - and a rejection the model
 * understands becomes a question to the user rather than a guess.
 */
export const ABSOLUTE_DATETIME =
  "Data e ora assolute in formato ISO, ad esempio '2026-09-05T10:00' per un orario preciso " +
  "o '2026-09-05' per un giorno intero. Calcolala tu partendo dalla data corrente indicata " +
  "nel contesto: non scrivere mai espressioni relative come 'domani' o 'venerdì', vengono rifiutate."

export const ABSOLUTE_DATE =
  "Giorno in formato ISO 'AAAA-MM-GG', ad esempio '2026-09-05'. Calcolalo partendo dalla data " +
  'corrente indicata nel contesto: le espressioni relative vengono rifiutate.'

export const optionalString = z.string().nullish()

/** Resolves a name against the user's own list, or explains why it cannot. */
export function requireMatch<T extends { id: string; name: string }>(
  items: readonly T[],
  name: string | null | undefined,
  what: string,
): T {
  const match = matchByName(items, name)
  if (match) return match

  const available = items.map((item) => item.name).join(', ')
  throw new ValidationError(
    `Non ho trovato ${what} "${name}". Quelli disponibili sono: ${available}. Chiedi all'utente quale intende.`,
  )
}

/** Same, but a missing name is allowed and simply means "not specified". */
export function optionalMatch<T extends { id: string; name: string }>(
  items: readonly T[],
  name: string | null | undefined,
  what: string,
): T | null {
  if (!name || name.trim() === '') return null
  return requireMatch(items, name, what)
}
