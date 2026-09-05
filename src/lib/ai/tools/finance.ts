import { z } from 'zod'
import { defineTool } from '@/lib/ai/tools/types'
import { ABSOLUTE_DATE, optionalMatch, requireMatch } from '@/lib/ai/tools/shared'
import { formatEUR } from '@/lib/utils/currency'
import { formatRelativeDay, monthRange, todayISO } from '@/lib/utils/date'
import {
  createTransaction,
  getFinancialSummary,
  listAccounts,
  listCategories,
  listTransactions,
} from '@/lib/services/finance'

export const createTransactionTool = defineTool({
  name: 'create_transaction',
  description:
    'Registra un movimento di denaro: una spesa, un\'entrata o un trasferimento fra conti. ' +
    'Usalo ogni volta che la persona dice di avere speso, incassato o spostato dei soldi ' +
    '("ho speso 35 euro al supermercato", "mi è arrivato lo stipendio").',
  parameters: z.object({
    amount: z
      .string()
      .describe(
        "Importo sempre positivo, senza segno. Va bene il formato italiano: '35', '35,50', '1.234,56'. " +
          'La direzione la stabilisce il campo type, non il segno.',
      ),
    type: z
      .enum(['expense', 'income', 'transfer'])
      .describe("'expense' se ha speso, 'income' se ha incassato, 'transfer' se ha spostato fra suoi conti."),
    description: z
      .string()
      .nullish()
      .describe("Per cosa, con le parole della persona: 'supermercato', 'benzina', 'stipendio'."),
    categoryName: z
      .string()
      .nullish()
      .describe(
        'Nome della categoria, scelto fra quelle elencate nel contesto. Non inventarne di nuove: ' +
          'se nessuna calza, ometti il campo e chiedi alla persona.',
      ),
    accountName: z
      .string()
      .nullish()
      .describe('Conto da cui esce o in cui entra il denaro. Se omesso si usa il primo conto.'),
    toAccountName: z
      .string()
      .nullish()
      .describe("Solo per i trasferimenti: conto di destinazione. Obbligatorio se type è 'transfer'."),
    occurredOn: z
      .string()
      .nullish()
      .describe(`Giorno del movimento. ${ABSOLUTE_DATE} Ometti se è oggi.`),
  }),
  async execute(ctx, args) {
    const [accounts, categories] = await Promise.all([
      listAccounts(ctx.db, ctx.userId),
      listCategories(ctx.db, ctx.userId, args.type === 'income' ? 'income' : 'expense'),
    ])

    const account = args.accountName
      ? requireMatch(accounts, args.accountName, 'il conto')
      : accounts[0]

    const toAccount =
      args.type === 'transfer'
        ? requireMatch(accounts, args.toAccountName, 'il conto di destinazione')
        : null

    const category =
      args.type === 'transfer' ? null : optionalMatch(categories, args.categoryName, 'la categoria')

    const transaction = await createTransaction(
      ctx.db,
      ctx.userId,
      {
        type: args.type,
        amount: args.amount,
        accountId: account.id,
        transferAccountId: toAccount?.id,
        categoryId: category?.id,
        description: args.description,
        occurredOn: args.occurredOn,
      },
      ctx.channel === 'telegram' ? 'telegram' : 'ai',
    )

    const amount = formatEUR(Number(transaction.amount))
    const when = formatRelativeDay(`${transaction.occurred_on}T12:00:00`)

    const summary =
      args.type === 'transfer'
        ? `Trasferiti ${amount} da ${account.name} a ${toAccount!.name} (${when}).`
        : args.type === 'income'
          ? `Registrata entrata di ${amount}${category ? ` — ${category.name}` : ''} su ${account.name} (${when}).`
          : `Registrata spesa di ${amount}${category ? ` — ${category.name}` : ''} su ${account.name} (${when}).`

    // The new balance is the number the person actually wants confirmed.
    const updated = (await listAccounts(ctx.db, ctx.userId)).find((a) => a.id === account.id)

    return {
      summary: `${summary} Saldo ${account.name}: ${formatEUR(Number(updated?.current_balance ?? 0))}.`,
      data: { id: transaction.id, amount: Number(transaction.amount) },
    }
  },
})

export const getFinancialSummaryTool = defineTool({
  name: 'get_financial_summary',
  description:
    'Restituisce entrate, uscite e differenza di un periodo, con la ripartizione per categoria. ' +
    'Usalo per domande tipo "quanto ho speso questo mese" o "come sto messo a soldi".',
  parameters: z.object({
    from: z.string().nullish().describe(`Inizio del periodo. ${ABSOLUTE_DATE} Se ometti entrambe le date si usa il mese corrente.`),
    to: z.string().nullish().describe(`Fine del periodo, inclusa. ${ABSOLUTE_DATE}`),
  }),
  async execute(ctx, args) {
    const range =
      args.from && args.to ? { from: args.from, to: args.to } : monthRange(ctx.now, ctx.timezone)

    const [summary, categories, accounts] = await Promise.all([
      getFinancialSummary(ctx.db, ctx.userId, range),
      listCategories(ctx.db, ctx.userId),
      listAccounts(ctx.db, ctx.userId),
    ])

    const categoryName = new Map(categories.map((c) => [c.id, c.name]))
    const balance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0)

    return {
      summary:
        `Dal ${range.from} al ${range.to}: entrate ${formatEUR(summary.income)}, ` +
        `uscite ${formatEUR(summary.expense)}, differenza ${formatEUR(summary.net)}. ` +
        `Saldo complessivo ${formatEUR(balance)}.`,
      data: {
        entrate: summary.income,
        uscite: summary.expense,
        differenza: summary.net,
        saldo: balance,
        perCategoria: summary.byCategory.slice(0, 8).map((entry) => ({
          categoria: entry.categoryId ? categoryName.get(entry.categoryId) : 'Senza categoria',
          totale: entry.total,
        })),
      },
    }
  },
})

export const listTransactionsTool = defineTool({
  name: 'list_transactions',
  description:
    'Elenca gli ultimi movimenti registrati. Usalo quando la persona vuole rivedere cosa ha ' +
    'speso di recente o cercare un movimento specifico.',
  parameters: z.object({
    from: z.string().nullish().describe(`Mostra solo i movimenti da questo giorno in poi. ${ABSOLUTE_DATE}`),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .nullish()
      .describe('Quanti movimenti restituire, al massimo 50. Se omesso ne restituisce 15.'),
  }),
  async execute(ctx, args) {
    const [transactions, categories, accounts] = await Promise.all([
      listTransactions(ctx.db, ctx.userId, {
        from: args.from ?? undefined,
        limit: args.limit ?? 15,
      }),
      listCategories(ctx.db, ctx.userId),
      listAccounts(ctx.db, ctx.userId),
    ])

    const categoryName = new Map(categories.map((c) => [c.id, c.name]))
    const accountName = new Map(accounts.map((a) => [a.id, a.name]))

    if (transactions.length === 0) {
      return { summary: 'Nessun movimento nel periodo richiesto.', data: [] }
    }

    return {
      summary: `${transactions.length} movimenti trovati.`,
      data: transactions.map((t) => ({
        giorno: t.occurred_on,
        tipo: t.type,
        importo: Number(t.amount),
        descrizione: t.description,
        categoria: t.category_id ? categoryName.get(t.category_id) : null,
        conto: accountName.get(t.account_id),
      })),
    }
  },
})

/** Exposed for the context builder, which lists today's date to the model. */
export { todayISO }
