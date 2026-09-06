'use client'

import { useTransition } from 'react'
import { ArrowRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatEUR } from '@/lib/utils/currency'
import { formatRelativeDay } from '@/lib/utils/date'
import { deleteTransactionAction } from '@/app/(app)/finance/actions'
import type { AccountRow, CategoryRow, TransactionRow } from '@/lib/services/finance'

/**
 * The ledger.
 *
 * Amounts are set in the tabular face and right-aligned so a column of them
 * can be scanned by size rather than read one by one. Direction is carried by
 * a sign and by colour together - a person who cannot separate the two hues
 * still sees the minus.
 */
export function TransactionList({
  transactions,
  accounts,
  categories,
}: {
  transactions: TransactionRow[]
  accounts: AccountRow[]
  categories: CategoryRow[]
}) {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  return (
    <ul>
      {transactions.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          accountName={accountName}
          categoryName={categoryName}
        />
      ))}
    </ul>
  )
}

function TransactionRow({
  transaction,
  accountName,
  categoryName,
}: {
  transaction: TransactionRow
  accountName: Map<string, string>
  categoryName: Map<string, string>
}) {
  const [pending, startTransition] = useTransition()

  function remove() {
    startTransition(async () => {
      const result = await deleteTransactionAction(transaction.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  const amount = Number(transaction.amount)
  const isTransfer = transaction.type === 'transfer'
  const isIncome = transaction.type === 'income'

  const label =
    transaction.description ||
    (isTransfer
      ? 'Trasferimento'
      : (transaction.category_id ? categoryName.get(transaction.category_id) : null) ??
        (isIncome ? 'Entrata' : 'Uscita'))

  return (
    <li
      data-entity-id={transaction.id}
      className={cn(
        'group flex items-baseline gap-3 border-b border-rule py-3 last:border-b-0',
        pending && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-snug">{label}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="data">{formatRelativeDay(`${transaction.occurred_on}T12:00:00`)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            {accountName.get(transaction.account_id) ?? 'Conto'}
            {isTransfer && transaction.transfer_account_id ? (
              <>
                {/* The arrow carries the direction visually; an <svg> with only
                    an aria-label is not announced, so the word is spelled out
                    for anyone reading the row aloud. */}
                <span className="sr-only"> verso </span>
                <ArrowRight className="size-3" aria-hidden />
                {accountName.get(transaction.transfer_account_id) ?? 'Conto'}
              </>
            ) : null}
          </span>
          {!isTransfer && transaction.description && transaction.category_id ? (
            <>
              <span aria-hidden>·</span>
              <span>{categoryName.get(transaction.category_id)}</span>
            </>
          ) : null}
        </p>
      </div>

      <span
        className={cn(
          'data shrink-0 text-sm tabular-nums',
          isTransfer ? 'text-muted-foreground' : isIncome ? 'text-positive' : 'text-foreground',
        )}
      >
        {isTransfer ? '' : isIncome ? '+' : '−'}
        {formatEUR(amount)}
      </span>

      <button
        type="button"
        onClick={remove}
        aria-label={`Elimina movimento ${label}`}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  )
}
