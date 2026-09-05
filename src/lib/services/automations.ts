import { nextRunAfter } from '@/lib/automation/rules'
import { translateDbError } from '@/lib/services/errors'
import type { Db, Enums, Row } from '@/lib/db/types'

export type AutomationRow = Row<'automation_rules'>

/**
 * The automations someone can switch on, and what they are for.
 *
 * Deliberately few. Every one of these interrupts you, and a system that
 * interrupts often is one you mute - at which point the useful interruption
 * gets muted too.
 */
export const AUTOMATION_CATALOGUE: {
  kind: Enums['automation_kind']
  label: string
  description: string
  defaultTime: string
}[] = [
  {
    kind: 'daily_briefing',
    label: 'Riepilogo del mattino',
    description: 'Appuntamenti, scadenze e abitudini della giornata. Silenzioso se non c\'è nulla.',
    defaultTime: '07:30',
  },
  {
    kind: 'daily_review',
    label: 'Chiusura della giornata',
    description: 'Cosa è stato fatto, cosa è rimasto, abitudini tenute e saltate.',
    defaultTime: '21:00',
  },
  {
    kind: 'weekly_review',
    label: 'Bilancio della settimana',
    description: 'I numeri che hanno senso solo su sette giorni: tempo, spese, obiettivi.',
    defaultTime: '18:00',
  },
  {
    kind: 'stale_task',
    label: 'Task fermi',
    description: 'Ti nomina il lavoro che non tocchi da due settimane, per decidere se serve ancora.',
    defaultTime: '09:00',
  },
  {
    kind: 'budget_alert',
    label: 'Budget quasi esaurito',
    description: 'Avvisa quando una categoria supera l\'80% del budget del mese.',
    defaultTime: '20:00',
  },
]

export async function listAutomations(db: Db, userId: string): Promise<AutomationRow[]> {
  const { data, error } = await db
    .from('automation_rules')
    .select('*')
    .eq('user_id', userId)

  if (error) throw translateDbError(error, 'Lettura delle automazioni non riuscita')
  return data ?? []
}

/**
 * Switches an automation on or off.
 *
 * Turning one on sets its next run rather than leaving it null, or the tick
 * would never pick it up: a rule with no next run is a rule that quietly does
 * nothing while appearing enabled.
 */
export async function setAutomation(
  db: Db,
  userId: string,
  kind: Enums['automation_kind'],
  enabled: boolean,
  timeOfDay?: string,
): Promise<AutomationRow> {
  const catalogue = AUTOMATION_CATALOGUE.find((entry) => entry.kind === kind)
  const time = timeOfDay ?? catalogue?.defaultTime ?? '08:00'

  const config = { time_of_day: time }
  const now = new Date()

  const { data, error } = await db
    .from('automation_rules')
    .upsert(
      {
        user_id: userId,
        kind,
        enabled,
        config,
        next_run_at: enabled
          ? nextRunAfter({ kind, config }, now).toISOString()
          : null,
      },
      { onConflict: 'user_id,kind' },
    )
    .select('*')
    .single()

  if (error) throw translateDbError(error, 'Modifica dell\'automazione non riuscita')
  return data
}
