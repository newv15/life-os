import { describeNowForPrompt } from '@/lib/utils/date'
import { listAccounts, listCategories } from '@/lib/services/finance'
import { listGoals } from '@/lib/services/goals'
import { listProjects } from '@/lib/services/projects'
import type { Db } from '@/lib/db/types'

/**
 * What the model is told before it answers.
 *
 * Deliberately small. The database is never handed over wholesale - only the
 * names the model needs in order to refer to real things: the accounts and
 * categories a spend can land in, the projects and goals a task can hang off.
 * Everything else it asks for with a tool.
 *
 * Two reasons to keep it this tight. The obvious one is cost and latency. The
 * one that matters more is that a model given a wall of data starts answering
 * from the wall instead of from the tools, and then it is guessing.
 */

export type AIContext = {
  now: Date
  timezone: string
  accounts: string[]
  expenseCategories: string[]
  incomeCategories: string[]
  projects: string[]
  goals: string[]
}

export async function buildContext(
  db: Db,
  userId: string,
  now: Date,
  timezone: string,
): Promise<AIContext> {
  const [accounts, categories, projects, goals] = await Promise.all([
    listAccounts(db, userId),
    listCategories(db, userId),
    listProjects(db, userId),
    listGoals(db, userId),
  ])

  return {
    now,
    timezone,
    accounts: accounts.map((a) => a.name),
    expenseCategories: categories.filter((c) => c.kind === 'expense').map((c) => c.name),
    incomeCategories: categories.filter((c) => c.kind === 'income').map((c) => c.name),
    projects: projects.map((p) => p.name),
    goals: goals.map((g) => g.title),
  }
}

/** Renders the context as the block appended to the system prompt. */
export function renderContext(context: AIContext): string {
  const list = (values: string[]) => (values.length > 0 ? values.join(', ') : 'nessuno')

  return [
    `Adesso è ${describeNowForPrompt(context.timezone)}.`,
    '',
    'Elementi esistenti dell\'utente. Usa questi nomi esatti quando ti riferisci a loro,',
    'e non inventarne di nuovi: se serve qualcosa che non è in elenco, chiedi.',
    `- Conti: ${list(context.accounts)}`,
    `- Categorie di spesa: ${list(context.expenseCategories)}`,
    `- Categorie di entrata: ${list(context.incomeCategories)}`,
    `- Progetti attivi: ${list(context.projects)}`,
    `- Obiettivi attivi: ${list(context.goals)}`,
  ].join('\n')
}
