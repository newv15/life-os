'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { setAutomationAction } from '@/app/(app)/settings/actions'
import type { AUTOMATION_CATALOGUE } from '@/lib/services/automations'

export type AutomationState = {
  kind: string
  enabled: boolean
  timeOfDay: string
}

/**
 * Which interruptions you have agreed to.
 *
 * Each one states its hour next to its switch, because "the morning briefing"
 * arriving at 07:30 when you get up at 09:00 is the reason people turn these
 * off rather than adjust them.
 */
export function Automations({
  catalogue,
  states,
  telegramReady,
}: {
  catalogue: typeof AUTOMATION_CATALOGUE
  states: AutomationState[]
  telegramReady: boolean
}) {
  const byKind = new Map(states.map((state) => [state.kind, state]))

  return (
    <div className="mt-4 space-y-5">
      {!telegramReady ? (
        <p className="border-l-2 border-signal pl-4 text-sm leading-relaxed text-muted-foreground">
          Le automazioni scrivono su Telegram. Puoi attivarle già adesso: i messaggi restano in
          coda e arrivano appena colleghi il bot.
        </p>
      ) : null}

      <ul className="space-y-5">
        {catalogue.map((entry) => (
          <AutomationRow
            key={entry.kind}
            entry={entry}
            state={byKind.get(entry.kind)}
          />
        ))}
      </ul>
    </div>
  )
}

function AutomationRow({
  entry,
  state,
}: {
  entry: (typeof AUTOMATION_CATALOGUE)[number]
  state?: AutomationState
}) {
  const [pending, startTransition] = useTransition()
  const enabled = state?.enabled ?? false
  const time = state?.timeOfDay ?? entry.defaultTime

  function apply(nextEnabled: boolean, nextTime: string) {
    startTransition(async () => {
      const result = await setAutomationAction(entry.kind, nextEnabled, nextTime)
      if (!result.ok) toast.error(result.error)
    })
  }

  return (
    <li className={cn('flex items-start gap-3', pending && 'opacity-60')}>
      <label className="mt-0.5 flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => apply(event.target.checked, time)}
          className="size-4 accent-[var(--primary)]"
          aria-label={`Attiva ${entry.label}`}
        />
      </label>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{entry.label}</p>
        <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {entry.description}
        </p>
      </div>

      <Input
        type="time"
        value={time}
        disabled={!enabled}
        onChange={(event) => apply(true, event.target.value)}
        aria-label={`Orario di ${entry.label}`}
        className="data h-8 w-28 shrink-0"
      />
    </li>
  )
}
