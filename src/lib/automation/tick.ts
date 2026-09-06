import { escapeHtml } from '@/lib/telegram/format'
import { formatTime } from '@/lib/utils/date'
import type { TelegramClient } from '@/lib/telegram/api'
import type { Db, Row } from '@/lib/db/types'

/**
 * The heartbeat.
 *
 * Called every few minutes from GitHub Actions. Two properties govern
 * everything in here:
 *
 *  - It is idempotent. The same minute can be delivered twice, and a reminder
 *    sent twice is more annoying than one sent late.
 *  - It catches up. It works from what is due rather than from what happened
 *    since the last run, and looks a few hours into the past as well as ahead,
 *    so a delayed or skipped tick does not turn into a dropped reminder.
 *
 * Both matter because the scheduler is GitHub Actions, which is free and
 * therefore approximate: runs drift by minutes and occasionally do not happen.
 */

/** How long before an appointment to say something. */
const EVENT_LEAD_MINUTES = 30

/** How far ahead to look when creating reminders. */
const SCHEDULING_HORIZON_HOURS = 48

/**
 * How far back to look for deadlines that came due while nothing was running.
 *
 * Without this the scheduler only ever looked forward, so every deadline that
 * passed during an outage was dropped in silence - and since the scheduler is
 * free, and therefore occasionally absent for hours, that is not a rare case.
 * The first run in production skipped a reminder exactly this way.
 *
 * Bounded, though: catching up is not the same as never letting go. Six hours
 * keeps a deadline that passed this morning worth mentioning, and stops the
 * first run after a long silence from arriving as a wall of stale messages.
 *
 * Appointments deliberately get no such window. "Tra poco" about something
 * that started an hour ago is not late, it is wrong.
 */
const TASK_GRACE_HOURS = 6

/** After this many failures a message is dead rather than retried forever. */
const MAX_ATTEMPTS = 5

export type TickDeps = {
  db: Db
  /** Null when Telegram is unconfigured: scheduling still runs, delivery waits. */
  client: TelegramClient | null
  now?: Date
}

export type TickReport = {
  scheduled: number
  delivered: number
  failed: number
  automations: number
}

export async function runTick(deps: TickDeps): Promise<TickReport> {
  const now = deps.now ?? new Date()

  const scheduled = await scheduleReminders(deps.db, now)
  const automations = await runDueAutomations(deps.db, now)
  const { delivered, failed } = await deliverDue(deps.db, deps.client, now)

  return { scheduled, delivered, failed, automations }
}

// --- Scheduling --------------------------------------------------------------

type NotificationRow = Row<'notifications'>

/**
 * Turns things with a time on them into messages waiting to be sent.
 *
 * Done as a separate step from delivery so a reminder exists in the database
 * before its moment arrives - which is what makes a late tick harmless, and
 * what lets the reminder survive being edited or cancelled.
 */
async function scheduleReminders(db: Db, now: Date): Promise<number> {
  const horizon = new Date(now.getTime() + SCHEDULING_HORIZON_HOURS * 3600_000).toISOString()
  const graceStart = new Date(now.getTime() - TASK_GRACE_HOURS * 3600_000).toISOString()

  const [{ data: events }, { data: tasks }, { data: existing }] = await Promise.all([
    db
      .from('events')
      .select('id, user_id, title, starts_at, location')
      .gte('starts_at', now.toISOString())
      .lt('starts_at', horizon),
    db
      .from('tasks')
      .select('id, user_id, title, due_at')
      .in('status', ['inbox', 'todo', 'doing', 'blocked'])
      .not('due_at', 'is', null)
      .gte('due_at', graceStart)
      .lt('due_at', horizon),
    db.from('notifications').select('entity_type, entity_id').eq('kind', 'reminder'),
  ])

  // One reminder per thing, ever. Cheaper and clearer than a unique index that
  // would also block a deliberate second reminder later.
  const already = new Set(
    (existing ?? []).map((row) => `${row.entity_type}:${row.entity_id}`),
  )

  const pending: {
    user_id: string
    kind: 'reminder'
    title: string
    body: string | null
    entity_type: 'event' | 'task'
    entity_id: string
    scheduled_at: string
  }[] = []

  for (const event of events ?? []) {
    if (already.has(`event:${event.id}`)) continue

    // Half an hour before, or right now if it is already closer than that -
    // a reminder for something starting in ten minutes is still worth sending.
    const lead = new Date(new Date(event.starts_at).getTime() - EVENT_LEAD_MINUTES * 60_000)
    const when = lead < now ? now : lead

    pending.push({
      user_id: event.user_id,
      kind: 'reminder',
      title: `Tra poco: ${event.title}`,
      body: `Alle ${formatTime(event.starts_at)}${event.location ? ` — ${event.location}` : ''}`,
      entity_type: 'event',
      entity_id: event.id,
      scheduled_at: when.toISOString(),
    })
  }

  for (const task of tasks ?? []) {
    if (already.has(`task:${task.id}`)) continue

    // At the deadline, not before: a task is not an appointment you have to
    // travel to, and an early nudge is one more thing to dismiss.
    pending.push({
      user_id: task.user_id,
      kind: 'reminder',
      title: `In scadenza: ${task.title}`,
      body: null,
      entity_type: 'task',
      entity_id: task.id,
      scheduled_at: task.due_at!,
    })
  }

  if (pending.length === 0) return 0

  const { error } = await db.from('notifications').insert(pending)
  if (error) {
    console.error('[tick] creazione promemoria non riuscita', error)
    return 0
  }

  return pending.length
}

// --- Delivery ----------------------------------------------------------------

async function deliverDue(
  db: Db,
  client: TelegramClient | null,
  now: Date,
): Promise<{ delivered: number; failed: number }> {
  const { data: due, error } = await db
    .from('notifications')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('[tick] lettura delle notifiche non riuscita', error)
    return { delivered: 0, failed: 0 }
  }

  if (!due || due.length === 0 || !client) return { delivered: 0, failed: 0 }

  const chats = await chatIdsByUser(db, [...new Set(due.map((row) => row.user_id))])

  let delivered = 0
  let failed = 0

  for (const notification of due) {
    const chatId = chats.get(notification.user_id)

    // No bot connected yet. Left pending rather than failed, so everything
    // waiting arrives the moment one is linked.
    if (chatId === undefined) continue

    try {
      await client.sendMessage(chatId, renderNotification(notification))

      await db
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notification.id)

      delivered += 1
    } catch (error) {
      const attempts = notification.attempts + 1
      const message = error instanceof Error ? error.message : 'Invio non riuscito'

      // Retried until it is clearly hopeless: keeping dead messages in the
      // queue forever would make every tick slower and bury the live ones.
      await db
        .from('notifications')
        .update({
          attempts,
          last_error: message,
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        })
        .eq('id', notification.id)

      failed += 1
    }
  }

  return { delivered, failed }
}

function renderNotification(notification: NotificationRow): string {
  const icon =
    notification.kind === 'reminder'
      ? '⏰'
      : notification.kind === 'digest'
        ? '📊'
        : notification.kind === 'insight'
          ? '💡'
          : '⚠️'

  const body = notification.body ? `\n${escapeHtml(notification.body)}` : ''
  return `${icon} <b>${escapeHtml(notification.title)}</b>${body}`
}

async function chatIdsByUser(db: Db, userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map()

  const { data } = await db
    .from('telegram_accounts')
    .select('user_id, chat_id')
    .eq('status', 'active')
    .in('user_id', userIds)

  const chats = new Map<string, number>()
  for (const row of data ?? []) {
    if (row.chat_id !== null) chats.set(row.user_id, row.chat_id)
  }
  return chats
}

// --- Automations -------------------------------------------------------------

/**
 * Runs the rules whose moment has come.
 *
 * Each rule produces a notification rather than sending directly, so the same
 * delivery path, retry behaviour and audit apply to a morning briefing as to a
 * reminder.
 */
async function runDueAutomations(db: Db, now: Date): Promise<number> {
  const { data: rules } = await db
    .from('automation_rules')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', now.toISOString())

  if (!rules || rules.length === 0) return 0

  const { buildAutomationMessage, nextRunAfter } = await import('@/lib/automation/rules')

  let count = 0
  for (const rule of rules) {
    try {
      const message = await buildAutomationMessage(db, rule, now)

      if (message) {
        await db.from('notifications').insert({
          user_id: rule.user_id,
          kind: message.kind,
          title: message.title,
          body: message.body,
          scheduled_at: now.toISOString(),
        })
        count += 1
      }

      await db
        .from('automation_rules')
        .update({
          last_run_at: now.toISOString(),
          next_run_at: nextRunAfter(rule, now).toISOString(),
        })
        .eq('id', rule.id)
    } catch (error) {
      console.error(`[tick] automazione ${rule.kind} non riuscita`, error)

      // Pushed forward regardless, or a rule that always throws would be
      // retried on every tick for the rest of time.
      await db
        .from('automation_rules')
        .update({ next_run_at: nextRunAfter(rule, now).toISOString() })
        .eq('id', rule.id)
    }
  }

  return count
}
