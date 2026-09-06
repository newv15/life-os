import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/db/admin'
import { cronEnv, isTelegramConfigured } from '@/lib/env'
import { createTelegramClient } from '@/lib/telegram/api'
import { runTick } from '@/lib/automation/tick'
import { pruneOldUpdates } from '@/lib/telegram/webhook'

/**
 * The heartbeat, called from GitHub Actions every few minutes.
 *
 * Vercel's Hobby plan runs cron jobs once a day, which cannot deliver "your
 * appointment starts in half an hour", so the schedule lives in a workflow and
 * this is what it calls. The shared secret is the only thing protecting a
 * public URL, and it is compared in a way that does not leak its length
 * through timing.
 *
 * Runs with the service role because there is no session here: the work is
 * across all users, and each row carries its own owner.
 */
/**
 * Longer than the default, because one tick can deliver a backlog of reminders, each of
 * them a round trip to Telegram.
 *
 * Vercel cuts a function off at its limit with no warning to the caller, and
 * Telegram reads a dead connection as a delivery failure - so it redelivers,
 * and the work that did finish happens again.
 */
export const maxDuration = 60

export async function POST(request: NextRequest) {
  let secret: string
  try {
    secret = cronEnv().CRON_SECRET
  } catch (error) {
    console.error('[cron] non configurato', error)
    return NextResponse.json({ ok: false }, { status: 503 })
  }

  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!timingSafeEqual(provided, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  try {
    const db = createAdminClient()

    const report = await runTick({
      db,
      // Scheduling still runs without a bot: reminders queue up and arrive the
      // moment one is connected.
      client: isTelegramConfigured() ? createTelegramClient() : null,
    })

    await pruneOldUpdates(db)

    return NextResponse.json({ ok: true, ...report })
  } catch (error) {
    console.error('[cron] tick fallito', error)
    // A 500 here is worth having: the workflow marks the run red, which is the
    // only way a silent scheduler failure ever gets noticed.
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

/**
 * Compares without giving away how much of the secret matched.
 *
 * A plain === returns as soon as two characters differ, and the difference is
 * measurable over enough requests. This is cheap insurance on an endpoint that
 * anyone can reach.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return difference === 0
}
