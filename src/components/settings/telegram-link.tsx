'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/utils/date'
import { createLinkCodeAction, revokeTelegramLinkAction } from '@/app/(app)/settings/actions'

export type LinkRow = {
  telegramUserId: number | null
  status: string
  linkedAt: string | null
}

/**
 * Getting the bot connected.
 *
 * The code is shown large and monospaced because it is about to be retyped on
 * a phone, and the instruction that follows it is the literal message to send -
 * not a description of one. The expiry is stated, so a code that stops working
 * is explained rather than mysterious.
 */
export function TelegramLink({ links }: { links: LinkRow[] }) {
  const [pending, startTransition] = useTransition()
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null)

  const active = links.filter((link) => link.status === 'active')

  function generate() {
    startTransition(async () => {
      const result = await createLinkCodeAction()
      if (result.ok) setCode(result.data)
      else toast.error(result.error)
    })
  }

  function revoke(telegramUserId: number) {
    startTransition(async () => {
      const result = await revokeTelegramLinkAction(telegramUserId)
      if (result.ok) toast.success('Collegamento revocato.')
      else toast.error(result.error)
    })
  }

  return (
    <div className="mt-4">
      {active.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {active.map((link) => (
            <li key={link.telegramUserId} className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                Account Telegram <span className="data">{link.telegramUserId}</span> collegato
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => revoke(link.telegramUserId!)}
              >
                Revoca
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {code ? (
        <div className="border-l-2 border-primary pl-4">
          <p className="data text-2xl tracking-[0.2em]">{code.code}</p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Apri il bot su Telegram e mandagli questo messaggio:{' '}
            <span className="data text-foreground">/link {code.code}</span>
            <br />
            Il codice scade alle {formatTime(code.expiresAt)}.
          </p>
        </div>
      ) : (
        <Button size="sm" onClick={generate} disabled={pending}>
          {pending
            ? 'Genero…'
            : active.length > 0
              ? 'Collega un altro account'
              : 'Genera codice di collegamento'}
        </Button>
      )}
    </div>
  )
}
