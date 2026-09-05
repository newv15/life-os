import type { Metadata } from 'next'
import { Check, Minus } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { isAIConfigured, isTelegramConfigured } from '@/lib/env'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Impostazioni · Life OS' }

export default function SettingsPage() {
  const ai = isAIConfigured()
  const telegram = isTelegramConfigured()

  return (
    <>
      <PageHeader eyebrow="Configurazione" title="Impostazioni" />

      <section aria-labelledby="stato">
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
            readyHint="Il bot può ricevere messaggi. Collega il tuo account per iniziare a usarlo."
            missingHint="Servono TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET."
          />
        </ul>
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
