import type { Metadata } from 'next'
import { DaySpine } from '@/components/dashboard/day-spine'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { formatLongDate } from '@/lib/utils/date'

export const metadata: Metadata = {
  title: 'Oggi · Life OS',
}

export default async function TodayPage() {
  return (
    <>
      <PageHeader eyebrow={formatLongDate()} title="Oggi" />

      <section aria-labelledby="agenda" className="mb-10">
        <h2 id="agenda" className="eyebrow mb-3">
          Agenda
        </h2>
        <DaySpine items={[]} />
      </section>

      <section aria-labelledby="da-fare" className="mb-10">
        <h2 id="da-fare" className="eyebrow mb-3">
          Da fare
        </h2>
        <EmptyState
          title="Niente in scadenza oggi."
          hint="I task compaiono qui il giorno in cui scadono. Aggiungine uno da Task, oppure scrivilo al bot: «domani devo chiamare il commercialista»."
        />
      </section>

      <section aria-labelledby="finanze">
        <h2 id="finanze" className="eyebrow mb-3">
          Finanze
        </h2>
        <EmptyState
          title="Nessun movimento registrato."
          hint="Registra la prima spesa per vedere saldo e andamento del mese."
        />
      </section>
    </>
  )
}
