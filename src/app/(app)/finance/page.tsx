import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { BalanceSummary } from '@/components/finance/balance-summary'
import { TransactionComposer } from '@/components/finance/transaction-composer'
import { TransactionList } from '@/components/finance/transaction-list'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import {
  getFinancialSummary,
  listAccounts,
  listCategories,
  listTransactions,
} from '@/lib/services/finance'
import { monthRange } from '@/lib/utils/date'

export const metadata: Metadata = { title: 'Finanze · Life OS' }

const MONTH_NAMES = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
]

export default async function FinancePage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()
  const range = monthRange()

  const [accounts, categories, summary, transactions] = await Promise.all([
    listAccounts(db, userId),
    listCategories(db, userId),
    getFinancialSummary(db, userId, range),
    listTransactions(db, userId, { limit: 50 }),
  ])

  const monthLabel = MONTH_NAMES[Number(range.from.slice(5, 7)) - 1]

  return (
    <>
      <PageHeader eyebrow="Entrate e uscite" title="Finanze" />

      <BalanceSummary accounts={accounts} summary={summary} monthLabel={monthLabel} />

      <TransactionComposer accounts={accounts} categories={categories} />

      {transactions.length === 0 ? (
        <EmptyState
          title="Nessun movimento registrato."
          hint="Scrivi l'importo e per cosa è stato: conto, data e tipo sono già compilati, quindi bastano due campi."
        />
      ) : (
        <section aria-labelledby="movimenti">
          <h2 id="movimenti" className="eyebrow mb-2">
            Movimenti
          </h2>
          <TransactionList
            transactions={transactions}
            accounts={accounts}
            categories={categories}
          />
        </section>
      )}
    </>
  )
}
