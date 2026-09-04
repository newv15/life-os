import { describe, expect, it } from 'vitest'
import { createTransactionSchema, updateTransactionSchema } from '@/lib/validation/transaction'
import { todayISO } from '@/lib/utils/date'

const ACCOUNT = '11111111-1111-4111-8111-111111111111'
const OTHER_ACCOUNT = '22222222-2222-4222-8222-222222222222'
const CATEGORY = '33333333-3333-4333-8333-333333333333'

/**
 * Money validation. The rules here are the ones that keep a wrong number from
 * becoming a wrong balance - which, unlike a wrong task title, is not obvious
 * when you look at it later.
 */

describe('createTransactionSchema', () => {
  const base = { type: 'expense', accountId: ACCOUNT }

  it('reads an Italian amount', () => {
    expect(createTransactionSchema.parse({ ...base, amount: '1.234,56' }).amount).toBe(1234.56)
  })

  it('reads a plain number, the way an AI tool will send it', () => {
    expect(createTransactionSchema.parse({ ...base, amount: 35 }).amount).toBe(35)
  })

  it('tolerates the currency symbol a person types', () => {
    expect(createTransactionSchema.parse({ ...base, amount: '35,50 €' }).amount).toBe(35.5)
  })

  it.each(['0', '-35', 'abc', ''])('rejects an amount of %j', (amount) => {
    expect(createTransactionSchema.safeParse({ ...base, amount }).success).toBe(false)
  })

  it('dates the movement today when nothing says otherwise', () => {
    const parsed = createTransactionSchema.parse({ ...base, amount: '35' })
    // Today in Rome, not today in UTC: a spend at 00:30 belongs to the day the
    // person thinks they spent it.
    expect(parsed.occurredOn).toBe(todayISO())
  })

  it('accepts an explicit date', () => {
    const parsed = createTransactionSchema.parse({ ...base, amount: '35', occurredOn: '2026-08-30' })
    expect(parsed.occurredOn).toBe('2026-08-30')
  })

  it('rejects a date that does not exist', () => {
    expect(
      createTransactionSchema.safeParse({ ...base, amount: '35', occurredOn: '2026-02-30' }).success,
    ).toBe(false)
  })

  it('keeps the category when given one', () => {
    const parsed = createTransactionSchema.parse({ ...base, amount: '35', categoryId: CATEGORY })
    expect(parsed.categoryId).toBe(CATEGORY)
  })

  it('requires an account', () => {
    expect(createTransactionSchema.safeParse({ type: 'expense', amount: '35' }).success).toBe(false)
  })
})

describe('transfers', () => {
  it('accepts a transfer between two different accounts', () => {
    const parsed = createTransactionSchema.parse({
      type: 'transfer',
      accountId: ACCOUNT,
      transferAccountId: OTHER_ACCOUNT,
      amount: '200',
    })

    expect(parsed.transferAccountId).toBe(OTHER_ACCOUNT)
  })

  it('rejects a transfer with no destination', () => {
    const result = createTransactionSchema.safeParse({
      type: 'transfer',
      accountId: ACCOUNT,
      amount: '200',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a transfer that lands where it started', () => {
    const result = createTransactionSchema.safeParse({
      type: 'transfer',
      accountId: ACCOUNT,
      transferAccountId: ACCOUNT,
      amount: '200',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a destination on something that is not a transfer', () => {
    const result = createTransactionSchema.safeParse({
      type: 'expense',
      accountId: ACCOUNT,
      transferAccountId: OTHER_ACCOUNT,
      amount: '200',
    })

    expect(result.success).toBe(false)
  })
})

describe('updateTransactionSchema', () => {
  it('allows changing just the amount', () => {
    expect(updateTransactionSchema.parse({ amount: '40' })).toEqual({ amount: 40 })
  })

  it('still refuses a nonsensical amount', () => {
    expect(updateTransactionSchema.safeParse({ amount: '-1' }).success).toBe(false)
  })
})
