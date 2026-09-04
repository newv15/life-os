'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createTransactionAction } from '@/app/(app)/finance/actions'
import { todayISO } from '@/lib/utils/date'
import type { ActionResult } from '@/lib/actions/result'
import type { AccountRow, CategoryRow } from '@/lib/services/finance'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

type TransactionType = 'expense' | 'income' | 'transfer'

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Uscita',
  income: 'Entrata',
  transfer: 'Trasferimento',
}

/**
 * Recording a movement.
 *
 * The amount and what it was for come first and get the whole first line;
 * everything the system can guess - the account, the date, the type - sits on
 * the second line already filled in. The common case is two fields.
 *
 * The amount is a text field rather than a number one on purpose: it has to
 * accept "35,50", "1.234,56" and "35.50" alike, and a number input would fight
 * the comma depending on the browser's locale.
 */
export function TransactionComposer({
  accounts,
  categories,
}: {
  accounts: AccountRow[]
  categories: CategoryRow[]
}) {
  const [state, formAction] = useActionState<ActionResult<string> | null, FormData>(
    createTransactionAction,
    null,
  )

  useEffect(() => {
    if (state && !state.ok) {
      const first = state.issues ? Object.values(state.issues)[0] : undefined
      toast.error(first ?? state.error)
    }
  }, [state])

  // Each success returns a new token, which remounts the fields with their
  // defaults. Clearing the form this way keeps the type dropdown and the DOM
  // in step without reaching for state inside an effect.
  const resetKey = state?.ok ? state.data : 'initial'

  return (
    <ComposerFields
      key={resetKey}
      action={formAction}
      accounts={accounts}
      categories={categories}
    />
  )
}

function ComposerFields({
  action,
  accounts,
  categories,
}: {
  action: (formData: FormData) => void
  accounts: AccountRow[]
  categories: CategoryRow[]
}) {
  const [type, setType] = useState<TransactionType>('expense')

  const relevantCategories = categories.filter((c) =>
    type === 'income' ? c.kind === 'income' : c.kind === 'expense',
  )

  return (
    <form action={action} className="mb-8 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="amount"
          required
          inputMode="decimal"
          placeholder="0,00"
          aria-label="Importo in euro"
          className="data w-full sm:w-32"
        />
        <Input
          name="description"
          maxLength={500}
          placeholder="Per cosa?"
          aria-label="Descrizione"
          className="flex-1"
        />
        <SaveButton />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          name="type"
          aria-label="Tipo di movimento"
          value={type}
          onChange={(event) => setType(event.target.value as TransactionType)}
          className={SELECT_CLASS}
        >
          {(Object.keys(TYPE_LABELS) as TransactionType[]).map((value) => (
            <option key={value} value={value}>
              {TYPE_LABELS[value]}
            </option>
          ))}
        </select>

        <select name="accountId" aria-label="Conto" className={SELECT_CLASS}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>

        {type === 'transfer' ? (
          <select
            name="transferAccountId"
            aria-label="Conto di destinazione"
            required
            defaultValue=""
            className={SELECT_CLASS}
          >
            <option value="" disabled>
              Verso…
            </option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        ) : (
          <select name="categoryId" aria-label="Categoria" defaultValue="" className={SELECT_CLASS}>
            <option value="">Senza categoria</option>
            {relevantCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}

        <Input
          type="date"
          name="occurredOn"
          defaultValue={todayISO()}
          aria-label="Data"
          className="w-auto"
        />
      </div>
    </form>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Registro…' : 'Registra'}
    </Button>
  )
}
