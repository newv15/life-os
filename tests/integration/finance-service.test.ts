import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseConfigured,
  type Db,
  type TestUser,
} from '../helpers/supabase'
import {
  createTransaction,
  deleteTransaction,
  getFinancialSummary,
  listAccounts,
  listCategories,
  listTransactions,
  updateTransaction,
} from '@/lib/services/finance'
import { ConflictError, ValidationError } from '@/lib/services/errors'

/**
 * The finance service, against the real database.
 *
 * Balances are maintained by a Postgres trigger, not by application code, so
 * every one of these tests is really asking the same question: after this
 * operation, does the account still say the truth? That includes the awkward
 * cases - editing an amount after the fact, flipping an expense into an
 * income, deleting something from last month.
 */

describe.skipIf(!supabaseConfigured)('finance service', () => {
  const admin: Db = adminClient()
  let user: TestUser
  let main = ''
  let cash = ''
  let groceries = ''

  const balanceOf = async (accountId: string) => {
    const { data, error } = await admin
      .from('accounts')
      .select('current_balance')
      .eq('id', accountId)
      .single()
    if (error) throw error
    return Number(data.current_balance)
  }

  beforeAll(async () => {
    user = await createTestUser(admin, 'finance')

    // The bootstrap trigger already created these; the service must be able to
    // find them by the names a new account really has.
    const accounts = await listAccounts(admin, user.id)
    main = accounts.find((a) => a.name === 'Conto principale')!.id
    cash = accounts.find((a) => a.name === 'Contanti')!.id

    const categories = await listCategories(admin, user.id, 'expense')
    groceries = categories.find((c) => c.name === 'Spesa alimentare')!.id
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  it('starts every account at zero', async () => {
    expect(await balanceOf(main)).toBe(0)
    expect(await balanceOf(cash)).toBe(0)
  })

  it('takes an expense out of the account', async () => {
    const before = await balanceOf(main)
    await createTransaction(admin, user.id, {
      type: 'expense',
      accountId: main,
      categoryId: groceries,
      amount: '35',
      description: 'Supermercato',
    })

    expect(await balanceOf(main)).toBe(before - 35)
  })

  it('puts an income into the account', async () => {
    const before = await balanceOf(main)
    await createTransaction(admin, user.id, {
      type: 'income',
      accountId: main,
      amount: '1.500,00',
    })

    expect(await balanceOf(main)).toBe(before + 1500)
  })

  it('moves money between accounts without creating or destroying any', async () => {
    const mainBefore = await balanceOf(main)
    const cashBefore = await balanceOf(cash)

    await createTransaction(admin, user.id, {
      type: 'transfer',
      accountId: main,
      transferAccountId: cash,
      amount: '200',
    })

    expect(await balanceOf(main)).toBe(mainBefore - 200)
    expect(await balanceOf(cash)).toBe(cashBefore + 200)
  })

  it('adjusts the balance when the amount is corrected afterwards', async () => {
    const before = await balanceOf(cash)
    const tx = await createTransaction(admin, user.id, {
      type: 'expense',
      accountId: cash,
      amount: '10',
    })
    expect(await balanceOf(cash)).toBe(before - 10)

    await updateTransaction(admin, user.id, tx.id, { amount: '25' })
    expect(await balanceOf(cash)).toBe(before - 25)
  })

  it('adjusts the balance when an expense turns out to have been an income', async () => {
    const before = await balanceOf(cash)
    const tx = await createTransaction(admin, user.id, {
      type: 'expense',
      accountId: cash,
      amount: '50',
    })

    await updateTransaction(admin, user.id, tx.id, { type: 'income' })
    expect(await balanceOf(cash)).toBe(before + 50)
  })

  it('gives the money back when a movement is deleted', async () => {
    const before = await balanceOf(main)
    const tx = await createTransaction(admin, user.id, {
      type: 'expense',
      accountId: main,
      amount: '80',
    })
    expect(await balanceOf(main)).toBe(before - 80)

    await deleteTransaction(admin, user.id, tx.id)
    expect(await balanceOf(main)).toBe(before)
  })

  it('refuses an amount it cannot read, leaving the balance untouched', async () => {
    const before = await balanceOf(main)

    await expect(
      createTransaction(admin, user.id, { type: 'expense', accountId: main, amount: 'tanti' }),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(await balanceOf(main)).toBe(before)
  })

  it("refuses to move money into someone else's account", async () => {
    const other = await createTestUser(admin, 'finance-other')
    try {
      const theirAccounts = await listAccounts(admin, other.id)

      await expect(
        createTransaction(admin, user.id, {
          type: 'transfer',
          accountId: main,
          transferAccountId: theirAccounts[0].id,
          amount: '10',
        }),
      ).rejects.toBeInstanceOf(ConflictError)
    } finally {
      await deleteTestUser(admin, other.id)
    }
  }, 60_000)

  describe('summary', () => {
    it('separates what came in from what went out, and ignores transfers', async () => {
      const summaryUser = await createTestUser(admin, 'finance-summary')
      try {
        const accounts = await listAccounts(admin, summaryUser.id)
        const a = accounts[0].id
        const b = accounts[1].id

        await createTransaction(admin, summaryUser.id, {
          type: 'income',
          accountId: a,
          amount: '2000',
          occurredOn: '2026-09-02',
        })
        await createTransaction(admin, summaryUser.id, {
          type: 'expense',
          accountId: a,
          amount: '35,50',
          occurredOn: '2026-09-03',
        })
        // A transfer is not income and not spending: counting it would make
        // moving your own money look like earning it.
        await createTransaction(admin, summaryUser.id, {
          type: 'transfer',
          accountId: a,
          transferAccountId: b,
          amount: '500',
          occurredOn: '2026-09-03',
        })

        const summary = await getFinancialSummary(admin, summaryUser.id, {
          from: '2026-09-01',
          to: '2026-09-30',
        })

        expect(summary.income).toBe(2000)
        expect(summary.expense).toBe(35.5)
        expect(summary.net).toBe(1964.5)
      } finally {
        await deleteTestUser(admin, summaryUser.id)
      }
    }, 60_000)

    it('leaves out movements from other months', async () => {
      const summaryUser = await createTestUser(admin, 'finance-months')
      try {
        const accounts = await listAccounts(admin, summaryUser.id)
        await createTransaction(admin, summaryUser.id, {
          type: 'expense',
          accountId: accounts[0].id,
          amount: '100',
          occurredOn: '2026-08-31',
        })

        const summary = await getFinancialSummary(admin, summaryUser.id, {
          from: '2026-09-01',
          to: '2026-09-30',
        })

        expect(summary.expense).toBe(0)
      } finally {
        await deleteTestUser(admin, summaryUser.id)
      }
    }, 60_000)
  })

  it('lists the most recent movements first', async () => {
    const list = await listTransactions(admin, user.id, { limit: 5 })
    const dates = list.map((t) => t.occurred_on)

    expect([...dates].sort().reverse()).toEqual(dates)
  })
})
