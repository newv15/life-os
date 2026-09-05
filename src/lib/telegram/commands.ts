import { formatEUR } from '@/lib/utils/currency'
import { endOfDayInTimeZone, formatRelativeDay, formatTime, monthRange, todayISO } from '@/lib/utils/date'
import { escapeHtml, type ParsedCommand } from '@/lib/telegram/format'
import { getFinancialSummary, listAccounts } from '@/lib/services/finance'
import { listGoals } from '@/lib/services/goals'
import { listInboxItems, captureInboxItem } from '@/lib/services/inbox'
import { listTasks } from '@/lib/services/tasks'
import { GOAL_HORIZON_LABELS } from '@/lib/validation/enums'
import type { Db } from '@/lib/db/types'

/**
 * The slash commands.
 *
 * Shortcuts, not the main way in. Natural language is what this bot is for,
 * and these exist for the handful of things you want without composing a
 * sentence - "what's today", "how much have I spent". Anything not handled
 * here falls through to the AI on purpose.
 *
 * Returns null when the command is unknown, which is the signal to let the AI
 * try instead.
 */
export async function runCommand(
  db: Db,
  userId: string,
  { command, args }: ParsedCommand,
): Promise<string | null> {
  switch (command) {
    case 'start':
    case 'help':
      return HELP

    case 'today':
      return renderToday(db, userId)

    case 'tasks':
      return renderTasks(db, userId)

    case 'finance':
      return renderFinance(db, userId)

    case 'goals':
      return renderGoals(db, userId)

    case 'inbox':
      return renderInbox(db, userId)

    case 'add':
      return addToInbox(db, userId, args)

    default:
      return null
  }
}

const HELP = [
  '<b>Life OS</b>',
  '',
  'Scrivimi normalmente, senza comandi:',
  '• «ho speso 35 euro al supermercato»',
  '• «domani alle 10 devo chiamare il commercialista»',
  '• «come sto messo questa settimana?»',
  '',
  'Scorciatoie, se preferisci:',
  '/today — la giornata',
  '/tasks — cosa devi fare',
  '/finance — saldo e mese',
  '/goals — obiettivi e avanzamento',
  '/inbox — appunti da smistare',
  '/add — salva un appunto senza pensarci',
].join('\n')

async function renderToday(db: Db, userId: string): Promise<string> {
  const today = todayISO()
  const endOfToday = endOfDayInTimeZone(today).toISOString()

  const [due, open, accounts, summary] = await Promise.all([
    listTasks(db, userId, { dueBefore: endOfToday }),
    listTasks(db, userId),
    listAccounts(db, userId),
    getFinancialSummary(db, userId, monthRange()),
  ])

  const balance = accounts.reduce((sum, account) => sum + Number(account.current_balance), 0)

  const lines = [`<b>Oggi</b> — ${escapeHtml(formatRelativeDay(new Date()))}`, '']

  if (due.length === 0) {
    lines.push('Niente in scadenza oggi.')
  } else {
    for (const task of due) {
      const when = task.due_at ? `${formatTime(task.due_at)} ` : ''
      const late = task.due_at && new Date(task.due_at) < new Date() ? '⚠️ ' : '• '
      lines.push(`${late}${when}${escapeHtml(task.title)}`)
    }
  }

  lines.push('', `${open.length} task aperti in tutto.`)
  lines.push(`Saldo ${formatEUR(balance)} · uscite del mese ${formatEUR(summary.expense)}`)

  return lines.join('\n')
}

async function renderTasks(db: Db, userId: string): Promise<string> {
  const tasks = await listTasks(db, userId, { limit: 20 })

  if (tasks.length === 0) return 'Nessun task aperto.'

  const lines = ['<b>Task aperti</b>', '']
  for (const task of tasks) {
    const when = task.due_at ? ` — ${formatRelativeDay(task.due_at)} ${formatTime(task.due_at)}` : ''
    lines.push(`• ${escapeHtml(task.title)}${escapeHtml(when)}`)
  }

  return lines.join('\n')
}

async function renderFinance(db: Db, userId: string): Promise<string> {
  const [accounts, summary] = await Promise.all([
    listAccounts(db, userId),
    getFinancialSummary(db, userId, monthRange()),
  ])

  const balance = accounts.reduce((sum, account) => sum + Number(account.current_balance), 0)

  const lines = ['<b>Finanze</b>', '', `Saldo complessivo: ${formatEUR(balance)}`]
  for (const account of accounts) {
    lines.push(`• ${escapeHtml(account.name)}: ${formatEUR(Number(account.current_balance))}`)
  }

  lines.push(
    '',
    `Questo mese — entrate ${formatEUR(summary.income)}, uscite ${formatEUR(summary.expense)}, differenza ${formatEUR(summary.net)}`,
  )

  return lines.join('\n')
}

async function renderGoals(db: Db, userId: string): Promise<string> {
  const goals = await listGoals(db, userId)

  if (goals.length === 0) return 'Nessun obiettivo attivo.'

  const lines = ['<b>Obiettivi</b>', '']
  for (const goal of goals) {
    const progress = goal.progress === null ? '' : ` — ${goal.progress}%`
    const horizon = GOAL_HORIZON_LABELS[goal.horizon].toLowerCase()
    lines.push(`• ${escapeHtml(goal.title)} (${horizon})${progress}`)
  }

  return lines.join('\n')
}

async function renderInbox(db: Db, userId: string): Promise<string> {
  const items = await listInboxItems(db, userId)

  if (items.length === 0) return "L'inbox è vuota."

  const lines = [`<b>Inbox</b> — ${items.length} da smistare`, '']
  for (const item of items.slice(0, 15)) {
    lines.push(`• ${escapeHtml(item.raw_text.slice(0, 120))}`)
  }

  return lines.join('\n')
}

async function addToInbox(db: Db, userId: string, args: string): Promise<string> {
  if (args.trim() === '') {
    return 'Scrivi <code>/add</code> seguito da quello che vuoi salvare.'
  }

  await captureInboxItem(db, userId, { rawText: args }, 'telegram')
  return 'Salvato in inbox.'
}
