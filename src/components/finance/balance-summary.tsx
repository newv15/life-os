import { formatEUR } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import type { AccountRow, FinancialSummary } from '@/lib/services/finance'

/**
 * The two numbers that answer "how am I doing" before any reading happens:
 * what is left, and what the month has done to it.
 *
 * The total comes first and largest because it is the one glanced at; the
 * per-account breakdown sits under it for when the answer is "where".
 */
export function BalanceSummary({
  accounts,
  summary,
  monthLabel,
}: {
  accounts: AccountRow[]
  summary: FinancialSummary
  monthLabel: string
}) {
  const total = accounts.reduce((sum, account) => sum + Number(account.current_balance), 0)

  return (
    <section aria-labelledby="saldo" className="mb-8">
      <h2 id="saldo" className="eyebrow mb-2">
        Saldo
      </h2>

      <p className="data text-3xl leading-none">{formatEUR(total)}</p>

      {accounts.length > 1 ? (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {accounts.map((account) => (
            <li key={account.id} className="text-xs text-muted-foreground">
              {account.name}{' '}
              <span className="data text-foreground">
                {formatEUR(Number(account.current_balance))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="mt-5 flex gap-8 border-t border-rule pt-4">
        <Figure label={`Entrate ${monthLabel}`} value={summary.income} tone="positive" />
        <Figure label={`Uscite ${monthLabel}`} value={summary.expense} tone="neutral" />
        <Figure label="Differenza" value={summary.net} tone="net" />
      </dl>
    </section>
  )
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'positive' | 'neutral' | 'net'
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'data mt-0.5 text-base',
          tone === 'positive' && 'text-positive',
          tone === 'net' && value < 0 && 'text-destructive',
        )}
      >
        {formatEUR(value)}
      </dd>
    </div>
  )
}
