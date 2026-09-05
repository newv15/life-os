import type { Metadata } from 'next'
import { Check, Minus } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Automations } from '@/components/settings/automations'
import { TelegramLink } from '@/components/settings/telegram-link'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { listTelegramLinks } from '@/lib/services/telegram-link'
import { AUTOMATION_CATALOGUE, listAutomations } from '@/lib/services/automations'
import { isAIConfigured, isTelegramConfigured } from '@/lib/env'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Impostazioni · Life OS' }

export default async function SettingsPage() {
  const ai = isAIConfigured()
  const telegram = isTelegramConfigured()

  const db = await createServerSupabase()
  const userId = await requireUserId()
  const [links, automations] = await Promise.all([
    listTelegramLinks(db, userId),
    listAutomations(db, userId),
  ])

  return (
    <>
      <PageHeader eyebrow="Configurazione" title="Impostazioni" />

      <section aria-labelledby="stato" className="mb-10">
        <h2 id="stato" className="eyebrow mb-3">
          Stato del sistema
        </h2>

        <ul className="space-y-4">
          <StatusRow
            ready={ai}
            title="Assistente AI"
            readyHint="La barra dei comandi è attiva su ogni schermata."
            missingHint="Serve una chiave del modello in AI_API_KEY. Finché manca, la barra dei comandi resta nascosta e tutto il resto funziona normalmente."
          />
          <StatusRow
            ready={telegram}
            title="Bot Telegram"
            readyHint="Il bot può ricevere messaggi."
            missingHint="Servono TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET."
          />
        </ul>
      </section>

      <section aria-labelledby="telegram" className="mb-10">
        <h2 id="telegram" className="eyebrow mb-2">
          Telegram
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Il collegamento usa l&apos;identificativo numerico del tuo account Telegram, mai il nome
          o lo @username, che chiunque può cambiare. Generi un codice qui e lo mandi al bot: da
          quel momento riconosce te e nessun altro.
        </p>

        <TelegramLink
          links={links.map((link) => ({
            telegramUserId: link.telegram_user_id,
            status: link.status,
            linkedAt: link.linked_at,
          }))}
        />
      </section>

      <section aria-labelledby="automazioni">
        <h2 id="automazioni" className="eyebrow mb-2">
          Quando farmi sentire
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Sono poche di proposito. Un sistema che interrompe spesso è un sistema che si silenzia,
          e a quel punto si perde anche l&apos;interruzione che serviva.
        </p>

        <Automations
          catalogue={AUTOMATION_CATALOGUE}
          telegramReady={links.some((link) => link.status === 'active')}
          states={automations.map((rule) => ({
            kind: rule.kind,
            enabled: rule.enabled,
            timeOfDay:
              (rule.config as { time_of_day?: string } | null)?.time_of_day ??
              AUTOMATION_CATALOGUE.find((entry) => entry.kind === rule.kind)?.defaultTime ??
              '08:00',
          }))}
        />
      </section>
    </>
  )
}

function StatusRow({
  ready,
  title,
  readyHint,
  missingHint,
}: {
  ready: boolean
  title: string
  readyHint: string
  missingHint: string
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
          ready ? 'bg-positive text-background' : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {ready ? <Check className="size-3" /> : <Minus className="size-3" />}
      </span>
      <div>
        <p className="text-sm font-medium">
          {title}{' '}
          <span className="font-normal text-muted-foreground">
            — {ready ? 'configurato' : 'non configurato'}
          </span>
        </p>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {ready ? readyHint : missingHint}
        </p>
      </div>
    </li>
  )
}
