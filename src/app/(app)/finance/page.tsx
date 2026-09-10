import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { BalanceSummary } from '@/components/finance/balance-summary'
import { CategoryBreakdown } from '@/components/finance/category-breakdown'
import { MonthNav } from '@/components/finance/month-nav'
import { TransactionComposer } from '@/components/finance/transaction-composer'
import { TransactionList } from '@/components/finance/transaction-list'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import {
  getFinancialSummary,
  listAccounts,
  listCategories,
  listTransactions,
} from '@/lib/services/finance'
import { formatMonthKey, monthKeyOf, monthRangeFromKey } from '@/lib/utils/date'

export const metadata: Metadata = { title: 'Finanze · Life OS' }

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

export default async function FinancePage({ searchParams }: PageProps<'/finance'>) {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  const current = monthKeyOf()
  const params = await searchParams
  const requested = typeof params.mese === 'string' ? params.mese : null

  // A malformed or future month falls back to this one rather than showing an
  // empty screen that looks like lost data.
  const month =
    requested && MONTH_KEY.test(requested) && requested <= current ? requested : current
  const range = monthRangeFromKey(month)

  const [accounts, categories, summary, transactions] = await Promise.all([
    listAccounts(db, userId),
    listCategories(db, userId),
    getFinancialSummary(db, userId, range),
    // Bounded by the month on screen: a list showing movements from a month
    // you are not looking at would make every total look wrong.
    listTransactions(db, userId, { from: range.from, to: range.to, limit: 200 }),
  ])

  return (
    <>
      <PageHeader eyebrow="Entrate e uscite" title="Finanze" />

      <MonthNav month={month} current={current} />

      <BalanceSummary
        accounts={accounts}
        summary={summary}
        monthLabel={formatMonthKey(month).split(' ')[0]}
        showingPastMonth={month !== current}
      />

      <CategoryBreakdown
        slices={summary.byCategory}
        categories={categories}
        total={summary.expense}
      />

      {month === current ? (
        <TransactionComposer accounts={accounts} categories={categories} />
      ) : null}

      {transactions.length === 0 ? (
        <EmptyState
          title={
            month === current
              ? 'Nessun movimento registrato.'
              : `Nessun movimento a ${formatMonthKey(month)}.`
          }
          hint={
            month === current
              ? "Scrivi l'importo e per cosa è stato: conto, data e tipo sono già compilati, quindi bastano due campi."
              : 'Usa le frecce qui sopra per cambiare mese.'
          }
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
