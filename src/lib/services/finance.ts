import { NotFoundError, parseOrThrow } from '@/lib/services/errors'
import {
  deleteTransactionRow,
  insertTransaction,
  selectAccounts,
  selectCategories,
  selectTransactionById,
  selectTransactions,
  updateTransactionRow,
  type AccountRow,
  type CategoryRow,
  type TransactionFilters,
  type TransactionRow,
} from '@/lib/db/repositories/finance'
import { createTransactionSchema, updateTransactionSchema } from '@/lib/validation/transaction'
import type { Db, Enums } from '@/lib/db/types'

export type { AccountRow, CategoryRow, TransactionRow, TransactionFilters }

export async function listAccounts(db: Db, userId: string): Promise<AccountRow[]> {
  return selectAccounts(db, userId)
}

export async function listCategories(
  db: Db,
  userId: string,
  kind?: Enums['category_kind'],
): Promise<CategoryRow[]> {
  return selectCategories(db, userId, kind)
}

export async function createTransaction(
  db: Db,
  userId: string,
  input: unknown,
  createdVia: Enums['created_via'] = 'web',
): Promise<TransactionRow> {
  const data = parseOrThrow(createTransactionSchema, input)

  return insertTransaction(db, userId, {
    type: data.type,
    account_id: data.accountId,
    transfer_account_id: data.transferAccountId,
    amount: data.amount,
    category_id: data.categoryId,
    description: data.description,
    occurred_on: data.occurredOn,
    project_id: data.projectId,
    person_id: data.personId,
    created_via: createdVia,
  })
}

export async function getTransaction(
  db: Db,
  userId: string,
  id: string,
): Promise<TransactionRow | null> {
  return selectTransactionById(db, userId, id)
}

export async function listTransactions(
  db: Db,
  userId: string,
  filters: TransactionFilters = {},
): Promise<TransactionRow[]> {
  return selectTransactions(db, userId, filters)
}

/**
 * Edits are validated as a whole row, not as a patch.
 *
 * Changing `type` alone can make a row illegal - an expense carrying no
 * destination becomes a transfer that has nowhere to go - and the database
 * would reject it with a constraint name rather than a sentence. Merging the
 * change into the current row and re-running the full schema means the same
 * rules, and the same readable messages, apply to edits as to creation.
 */
export async function updateTransaction(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
): Promise<TransactionRow> {
  const patch = parseOrThrow(updateTransactionSchema, input)
  const current = await selectTransactionById(db, userId, id)
  if (!current) throw new NotFoundError('Movimento non trovato.')

  const merged = parseOrThrow(createTransactionSchema, {
    type: patch.type ?? current.type,
    accountId: patch.accountId ?? current.account_id,
    transferAccountId:
      patch.transferAccountId !== undefined
        ? patch.transferAccountId
        : current.transfer_account_id,
    amount: patch.amount ?? Number(current.amount),
    categoryId: patch.categoryId !== undefined ? patch.categoryId : current.category_id,
    description: patch.description !== undefined ? patch.description : current.description,
    occurredOn: patch.occurredOn ?? current.occurred_on,
    projectId: patch.projectId !== undefined ? patch.projectId : current.project_id,
    personId: patch.personId !== undefined ? patch.personId : current.person_id,
  })

  const updated = await updateTransactionRow(db, userId, id, {
    type: merged.type,
    account_id: merged.accountId,
    transfer_account_id: merged.transferAccountId,
    amount: merged.amount,
    category_id: merged.categoryId,
    description: merged.description,
    occurred_on: merged.occurredOn,
    project_id: merged.projectId,
    person_id: merged.personId,
  })

  if (!updated) throw new NotFoundError('Movimento non trovato.')
  return updated
}

export async function deleteTransaction(db: Db, userId: string, id: string): Promise<void> {
  await deleteTransactionRow(db, userId, id)
}

export type CategoryTotal = {
  categoryId: string | null
  total: number
}

export type FinancialSummary = {
  income: number
  expense: number
  /** What actually stayed: income minus spending. */
  net: number
  byCategory: CategoryTotal[]
}

/**
 * Totals for a period.
 *
 * Transfers are deliberately excluded from every figure. Moving 500 euro from
 * the current account to savings is not earning 500 and not spending 500 - it
 * is the same money in a different place, and counting it would make a good
 * month look like a great one.
 *
 * Aggregation happens in memory rather than in SQL: one person's movements in
 * a month are a handful of rows, and keeping it here means the same code
 * answers for the dashboard and for the AI summary tools later.
 */
export async function getFinancialSummary(
  db: Db,
  userId: string,
  range: { from: string; to: string },
): Promise<FinancialSummary> {
  const rows = await selectTransactions(db, userId, { from: range.from, to: range.to })

  let income = 0
  let expense = 0
  const perCategory = new Map<string | null, number>()

  for (const row of rows) {
    const amount = Number(row.amount)
    if (row.type === 'income') {
      income += amount
    } else if (row.type === 'expense') {
      expense += amount
      perCategory.set(row.category_id, (perCategory.get(row.category_id) ?? 0) + amount)
    }
  }

  return {
    income: round(income),
    expense: round(expense),
    net: round(income - expense),
    byCategory: [...perCategory.entries()]
      .map(([categoryId, total]) => ({ categoryId, total: round(total) }))
      .sort((a, b) => b.total - a.total),
  }
}

/** Money is kept to the cent; floating point addition is not. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}
