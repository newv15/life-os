import { translateDbError } from '@/lib/services/errors'
import type { Db, Enums, OwnedInsert, Row, Update } from '@/lib/db/types'

/**
 * Data access for accounts, categories and transactions.
 *
 * Note what is absent: nothing here writes `current_balance`. Balances are
 * maintained by a database trigger, so there is no code path - web, Telegram
 * or cron - that can leave an account disagreeing with its own movements.
 */

export type AccountRow = Row<'accounts'>
export type CategoryRow = Row<'categories'>
export type TransactionRow = Row<'transactions'>

export type TransactionFilters = {
  /** Inclusive calendar bounds, as YYYY-MM-DD. */
  from?: string
  to?: string
  accountId?: string
  categoryId?: string
  type?: Enums['transaction_type']
  limit?: number
}

export async function selectAccounts(
  db: Db,
  userId: string,
  includeArchived = false,
): Promise<AccountRow[]> {
  let query = db.from('accounts').select('*').eq('user_id', userId)
  if (!includeArchived) query = query.is('archived_at', null)

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) throw translateDbError(error, 'Lettura dei conti non riuscita')
  return data ?? []
}

export async function selectCategories(
  db: Db,
  userId: string,
  kind?: Enums['category_kind'],
): Promise<CategoryRow[]> {
  let query = db.from('categories').select('*').eq('user_id', userId)
  if (kind) query = query.eq('kind', kind)

  const { data, error } = await query.order('name', { ascending: true })
  if (error) throw translateDbError(error, 'Lettura delle categorie non riuscita')
  return data ?? []
}

export async function insertTransaction(
  db: Db,
  userId: string,
  values: OwnedInsert<'transactions'>,
): Promise<TransactionRow> {
  const { data, error } = await db
    .from('transactions')
    .insert({ ...values, user_id: userId })
    .select('*')
    .single()

  if (error) throw translateDbError(error, 'Registrazione del movimento non riuscita')
  return data
}

export async function selectTransactionById(
  db: Db,
  userId: string,
  id: string,
): Promise<TransactionRow | null> {
  const { data, error } = await db
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw translateDbError(error, 'Lettura del movimento non riuscita')
  return data
}

export async function selectTransactions(
  db: Db,
  userId: string,
  filters: TransactionFilters = {},
): Promise<TransactionRow[]> {
  let query = db.from('transactions').select('*').eq('user_id', userId)

  if (filters.from) query = query.gte('occurred_on', filters.from)
  if (filters.to) query = query.lte('occurred_on', filters.to)
  if (filters.accountId) query = query.eq('account_id', filters.accountId)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.type) query = query.eq('type', filters.type)

  query = query
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw translateDbError(error, 'Lettura dei movimenti non riuscita')
  return data ?? []
}

export async function updateTransactionRow(
  db: Db,
  userId: string,
  id: string,
  patch: Update<'transactions'>,
): Promise<TransactionRow | null> {
  const { data, error } = await db
    .from('transactions')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Modifica del movimento non riuscita')
  return data
}

export async function deleteTransactionRow(
  db: Db,
  userId: string,
  id: string,
): Promise<boolean> {
  const { data, error } = await db
    .from('transactions')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Eliminazione del movimento non riuscita')
  return data !== null
}
