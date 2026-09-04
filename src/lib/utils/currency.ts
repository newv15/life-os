/**
 * Money in and money out.
 *
 * Two directions, two very different problems:
 *
 *  - Out is easy: one Italian format, everywhere, always.
 *  - In is not. The same amount arrives as "35", "35,50", "1.234,56", "35.50"
 *    or "1,234.56" depending on whether it was typed by hand, dictated to the
 *    bot, or emitted by a model that learned on English text. Guessing wrong
 *    turns 1.234 euro into 1234 euro, so the rules below are explicit and
 *    tested rather than left to the runtime's locale.
 *
 * Amounts are handled as numbers only at the edges. The database stores
 * numeric(14,2); nothing here is used for arithmetic on stored balances.
 */

export class InvalidAmountError extends Error {
  constructor(value: string) {
    super(`Importo non interpretabile: "${value}"`)
    this.name = 'InvalidAmountError'
  }
}

const eurFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  // Italian CLDR does not group four-digit numbers, so 1234,50 would print
  // ungrouped while 12.345,00 next to it would not. In a column of amounts set
  // in a tabular face that inconsistency is exactly what the eye trips on, so
  // grouping is forced - which is also what Italian banking apps show.
  useGrouping: 'always',
})

/** "1.234,56 €" - the only way money is ever shown. */
export function formatEUR(amount: number | string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(value)) throw new InvalidAmountError(String(amount))
  return eurFormatter.format(value)
}

/** Signed, for ledgers: an expense reads "−35,00 €" rather than needing colour. */
export function formatSignedEUR(amount: number | string, direction: 'in' | 'out'): string {
  const formatted = formatEUR(amount)
  return direction === 'out' ? `−${formatted}` : `+${formatted}`
}

/**
 * Reads a human- or model-written amount.
 *
 * The separator rules, in order:
 *
 *  1. Both `.` and `,` present - the RIGHTMOST one is the decimal separator and
 *     the other is grouping. Covers "1.234,56" and "1,234.56" alike.
 *  2. Only `,` - decimal separator. In Italian input a comma never groups.
 *  3. Only `.` - ambiguous. Exactly three digits after it and no decimals
 *     elsewhere means grouping ("1.234" is milleduecentotrentaquattro);
 *     anything else is a decimal point ("35.50").
 *
 * Currency symbols, spaces and a leading sign are tolerated. Anything that is
 * not a number after that throws, so a misread never becomes a silent
 * transaction.
 */
export function parseAmount(input: string): number {
  const cleaned = input
    .replace(/[€\s ]/g, '')
    .replace(/eur(o|os)?/gi, '')
    .trim()

  if (cleaned === '') throw new InvalidAmountError(input)

  const negative = cleaned.startsWith('-') || cleaned.startsWith('−')
  const digits = cleaned.replace(/^[+\-−]/, '')

  if (!/^[\d.,]+$/.test(digits)) throw new InvalidAmountError(input)

  const lastComma = digits.lastIndexOf(',')
  const lastDot = digits.lastIndexOf('.')

  let normalised: string

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const groupSep = decimalSep === ',' ? '.' : ','
    normalised = digits.split(groupSep).join('').replace(decimalSep, '.')
  } else if (lastComma !== -1) {
    normalised = digits.split(',').join('.')
    if (normalised.split('.').length > 2) throw new InvalidAmountError(input)
  } else if (lastDot !== -1) {
    const afterDot = digits.length - lastDot - 1
    const isGrouping = afterDot === 3 && digits.split('.').every((p, i) => i === 0 || p.length === 3)
    normalised = isGrouping ? digits.split('.').join('') : digits
    if (!isGrouping && normalised.split('.').length > 2) throw new InvalidAmountError(input)
  } else {
    normalised = digits
  }

  const value = Number(normalised)
  if (!Number.isFinite(value)) throw new InvalidAmountError(input)

  // Money is stored to the cent; anything finer is a parsing accident.
  const rounded = Math.round(value * 100) / 100
  return negative ? -rounded : rounded
}
