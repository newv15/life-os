import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { EventComposer } from '@/components/calendar/event-composer'
import { EventList } from '@/components/calendar/event-list'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { listEvents } from '@/lib/services/calendar'
import { startOfDayInTimeZone, todayISO } from '@/lib/utils/date'

export const metadata: Metadata = { title: 'Calendario · Life OS' }

export default async function CalendarPage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  // From the start of today rather than from now: something at 09:00 is still
  // today's business at 11:00, and dropping it would be a calendar that hides
  // what you are in the middle of.
  const events = await listEvents(db, userId, {
    from: startOfDayInTimeZone(todayISO()).toISOString(),
    limit: 60,
  })

  return (
    <>
      <PageHeader eyebrow="Impegni" title="Calendario" />

      <EventComposer />

      {events.length === 0 ? (
        <EmptyState
          title="Nessun impegno in programma."
          hint="Aggiungi un appuntamento qui sopra, oppure dillo all'assistente: «giovedì alle 15 ho il dentista»."
        />
      ) : (
        <EventList events={events} />
      )}
    </>
  )
}
