import { formatEUR } from '@/lib/utils/currency'
import {
  daysAgo,
  endOfDayInTimeZone,
  formatTime,
  monthRange,
  todayISO,
} from '@/lib/utils/date'
import { listEventsOnDay } from '@/lib/services/calendar'
import { getFinancialSummary, listAccounts } from '@/lib/services/finance'
import { listGoals } from '@/lib/services/goals'
import { listHabits } from '@/lib/services/habits'
import { listTasks } from '@/lib/services/tasks'
import { timeSummary } from '@/lib/services/personal'
import type { Db, Enums, Row } from '@/lib/db/types'

/**
 * What the system says when it speaks first.
 *
 * Each rule answers one question and stops. A morning briefing that lists
 * everything is a wall of text you stop reading by the third day, and a system
 * you stop reading is worse than one that never wrote.
 *
 * They produce a message rather than sending one, so the delivery path, the
 * retries and the audit trail are the same as for any other notification.
 */

type Rule = Row<'automation_rules'>

export type AutomationMessage = {
  kind: Enums['notification_kind']
  title: string
  body: string
}

export async function buildAutomationMessage(
  db: Db,
  rule: Rule,
  now: Date,
): Promise<AutomationMessage | null> {
  switch (rule.kind) {
    case 'daily_briefing':
      return dailyBriefing(db, rule.user_id, now)
    case 'daily_review':
      return dailyReview(db, rule.user_id, now)
    case 'weekly_review':
      return weeklyReview(db, rule.user_id, now)
    case 'stale_task':
      return staleTasks(db, rule.user_id)
    case 'budget_alert':
      return budgetAlert(db, rule.user_id, now)
    default:
      return null
  }
}

/** The morning: what today asks of you, in a few lines. */
async function dailyBriefing(
  db: Db,
  userId: string,
  now: Date,
): Promise<AutomationMessage | null> {
  const today = todayISO()
  const [events, due, habits] = await Promise.all([
    listEventsOnDay(db, userId, today),
    listTasks(db, userId, { dueBefore: endOfDayInTimeZone(today).toISOString() }),
    listHabits(db, userId),
  ])

  const habitsDue = habits.filter((habit) => habit.dueToday && !habit.doneToday)

  // Nothing scheduled, nothing due, nothing to keep: the honest thing is to
  // stay quiet rather than send "buongiorno, non hai niente".
  if (events.length === 0 && due.length === 0 && habitsDue.length === 0) return null

  const lines: string[] = []

  if (events.length > 0) {
    lines.push(...events.map((event) => `• ${formatTime(event.starts_at)} ${event.title}`))
  }

  if (due.length > 0) {
    const overdue = due.filter((task) => task.due_at && new Date(task.due_at) < now)
    lines.push(
      `${due.length} ${due.length === 1 ? 'cosa in scadenza' : 'cose in scadenza'}` +
        (overdue.length > 0 ? `, di cui ${overdue.length} già scadute` : ''),
    )
  }

  if (habitsDue.length > 0) {
    lines.push(`Abitudini da tenere: ${habitsDue.map((habit) => habit.name).join(', ')}`)
  }

  return { kind: 'digest', title: 'La tua giornata', body: lines.join('\n') }
}

/** The evening: what actually happened, without editorialising. */
async function dailyReview(
  db: Db,
  userId: string,
  now: Date,
): Promise<AutomationMessage | null> {
  const today = todayISO()
  const startOfToday = daysAgo(0, now)
  startOfToday.setHours(0, 0, 0, 0)

  const [done, stillOpen, habits, time] = await Promise.all([
    listTasks(db, userId, { status: 'done', limit: 50 }),
    listTasks(db, userId, { dueBefore: endOfDayInTimeZone(today).toISOString() }),
    listHabits(db, userId),
    timeSummary(db, userId, startOfToday.toISOString()),
  ])

  const doneToday = done.filter(
    (task) => task.completed_at && task.completed_at >= startOfToday.toISOString(),
  )
  const habitsKept = habits.filter((habit) => habit.doneToday)
  const habitsMissed = habits.filter((habit) => habit.dueToday && !habit.doneToday)

  if (doneToday.length === 0 && stillOpen.length === 0 && habitsKept.length === 0) return null

  const lines = [
    `Completati: ${doneToday.length}`,
    stillOpen.length > 0 ? `Rimasti in sospeso: ${stillOpen.length}` : null,
    habitsKept.length > 0 ? `Abitudini tenute: ${habitsKept.map((h) => h.name).join(', ')}` : null,
    habitsMissed.length > 0 ? `Saltate: ${habitsMissed.map((h) => h.name).join(', ')}` : null,
    time.totalSeconds > 0 ? `Tempo tracciato: ${Math.round(time.totalSeconds / 60)} min` : null,
  ].filter((line): line is string => line !== null)

  return { kind: 'digest', title: 'Com\'è andata oggi', body: lines.join('\n') }
}

/** The week: the numbers that only make sense over seven days. */
async function weeklyReview(
  db: Db,
  userId: string,
  now: Date,
): Promise<AutomationMessage> {
  const weekAgo = daysAgo(7, now)

  const [done, open, accounts, finance, habits, time, goals] = await Promise.all([
    listTasks(db, userId, { status: 'done', limit: 100 }),
    listTasks(db, userId),
    listAccounts(db, userId),
    getFinancialSummary(db, userId, monthRange(now)),
    listHabits(db, userId),
    timeSummary(db, userId, weekAgo.toISOString()),
    listGoals(db, userId),
  ])

  const doneThisWeek = done.filter(
    (task) => task.completed_at && task.completed_at >= weekAgo.toISOString(),
  )
  const balance = accounts.reduce((sum, account) => sum + Number(account.current_balance), 0)

  const lines = [
    `Completati in settimana: ${doneThisWeek.length}`,
    `Ancora aperti: ${open.length}`,
    `Tempo tracciato: ${Math.round(time.totalSeconds / 3600)}h`,
    `Saldo: ${formatEUR(balance)} · uscite del mese ${formatEUR(finance.expense)}`,
  ]

  const struggling = habits.filter((habit) => habit.consistency < 50)
  if (struggling.length > 0) {
    lines.push(`Abitudini che stanno scivolando: ${struggling.map((h) => h.name).join(', ')}`)
  }

  const stalled = goals.filter((goal) => goal.progress !== null && goal.progress < 100)
  if (stalled.length > 0) {
    lines.push(
      `Obiettivi in corso: ${stalled.map((goal) => `${goal.title} ${goal.progress}%`).join(' · ')}`,
    )
  }

  return { kind: 'digest', title: 'La settimana', body: lines.join('\n') }
}

/** Work that has been sitting untouched long enough to be worth a nudge. */
async function staleTasks(db: Db, userId: string): Promise<AutomationMessage | null> {
  const cutoff = daysAgo(14).toISOString()

  const { data } = await db
    .from('tasks')
    .select('title, updated_at')
    .eq('user_id', userId)
    .in('status', ['todo', 'doing', 'blocked'])
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(5)

  if (!data || data.length === 0) return null

  return {
    kind: 'insight',
    title: `${data.length} ${data.length === 1 ? 'task fermo' : 'task fermi'} da due settimane`,
    // Named rather than counted: a number is easy to dismiss, a title asks
    // whether the thing still matters.
    body: data.map((task) => `• ${task.title}`).join('\n'),
  }
}

/** Spending against a budget, mentioned only when it is actually close. */
async function budgetAlert(
  db: Db,
  userId: string,
  now: Date,
): Promise<AutomationMessage | null> {
  const range = monthRange(now)

  const [{ data: budgets }, summary] = await Promise.all([
    db.from('budgets').select('category_id, amount').eq('user_id', userId),
    getFinancialSummary(db, userId, range),
  ])

  if (!budgets || budgets.length === 0) return null

  const spentByCategory = new Map(
    summary.byCategory.map((entry) => [entry.categoryId, entry.total]),
  )

  const { data: categories } = await db
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)

  const names = new Map((categories ?? []).map((category) => [category.id, category.name]))

  const breaching = budgets
    .map((budget) => {
      const spent = spentByCategory.get(budget.category_id) ?? 0
      const limit = Number(budget.amount)
      return { name: names.get(budget.category_id ?? '') ?? 'Senza categoria', spent, limit }
    })
    // Below 80% there is nothing to say, and saying it anyway is how alerts
    // become noise that gets muted.
    .filter((row) => row.limit > 0 && row.spent / row.limit >= 0.8)

  if (breaching.length === 0) return null

  return {
    kind: 'alert',
    title: 'Budget quasi esaurito',
    body: breaching
      .map((row) => `• ${row.name}: ${formatEUR(row.spent)} di ${formatEUR(row.limit)}`)
      .join('\n'),
  }
}

// --- Scheduling --------------------------------------------------------------

type RuleConfig = { time_of_day?: string; weekday?: number }

/**
 * When a rule should run next.
 *
 * Computed forward from now rather than from the last scheduled time, so a
 * missed run does not queue up a backlog of yesterday's briefings - nobody
 * wants four of those at once after a weekend of downtime.
 */
export function nextRunAfter(
  // Only what is actually read: taking a whole row would force callers that
  // are about to create one to invent an id and timestamps.
  rule: Pick<Rule, 'kind' | 'config'>,
  now: Date,
): Date {
  const config = (rule.config ?? {}) as RuleConfig
  const [hours, minutes] = (config.time_of_day ?? '07:30').split(':').map(Number)

  const next = new Date(now)
  next.setHours(hours || 0, minutes || 0, 0, 0)

  if (rule.kind === 'weekly_review') {
    const target = config.weekday ?? 7 // domenica
    do {
      next.setDate(next.getDate() + 1)
    } while (((next.getDay() || 7) as number) !== target)
    return next
  }

  if (next <= now) next.setDate(next.getDate() + 1)
  return next
}
