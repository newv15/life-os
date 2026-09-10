import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { JournalEditor } from '@/components/journal/journal-editor'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { getJournalEntry, listJournalEntries } from '@/lib/services/personal'
import { formatLongDate, todayISO } from '@/lib/utils/date'

export const metadata: Metadata = { title: 'Diario · Life OS' }

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Fourteen days is a fortnight of reading; the rest is behind one link. */
const RECENT_DAYS = 14
const ALL_DAYS = 365

export default async function JournalPage({ searchParams }: PageProps<'/journal'>) {
  const db = await createServerSupabase()
  const userId = await requireUserId()
  const today = todayISO()

  const params = await searchParams
  const requested = typeof params.giorno === 'string' ? params.giorno : null
  const showAll = params.tutti === '1'

  // A day in the future is a slip, not an intention: nobody writes tomorrow's
  // diary, and an unreachable date would just be a page that never saves.
  const day = requested && ISO_DAY.test(requested) && requested <= today ? requested : today
  const isToday = day === today

  const [entry, recent] = await Promise.all([
    getJournalEntry(db, userId, day),
    listJournalEntries(db, userId, showAll ? ALL_DAYS : RECENT_DAYS),
  ])

  const past = recent.filter((item) => item.entry_date !== day)

  return (
    <>
      <PageHeader eyebrow={formatLongDate(isToday ? undefined : `${day}T12:00:00`)} title="Diario" />

      {isToday ? null : (
        <p className="mb-4 text-sm">
          <Link
            href="/journal"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            ← Torna a oggi
          </Link>
        </p>
      )}

      {/* The same editor, whichever day is open: writing yesterday's page is
          the same act as writing today's, and a read-only view of a diary you
          are allowed to edit would be a screen that only says no. */}
      <JournalEditor key={day} date={day} entry={entry} />

      {past.length > 0 ? (
        <section aria-labelledby="precedenti" className="mt-10">
          <h2 id="precedenti" className="eyebrow mb-3">
            Giorni precedenti
          </h2>

          <ul className="space-y-1">
            {past.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/journal?giorno=${item.entry_date}`}
                  data-entity-id={item.id}
                  className="block border-l-2 border-rule py-2 pl-4 transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <p className="data text-xs text-muted-foreground">
                    {formatLongDate(`${item.entry_date}T12:00:00`)}
                    {item.energy || item.mood ? (
                      <>
                        {' · '}
                        {item.energy ? `energia ${item.energy}` : null}
                        {item.energy && item.mood ? ' · ' : null}
                        {item.mood ? `umore ${item.mood}` : null}
                      </>
                    ) : null}
                  </p>
                  {item.body ? (
                    <p className="mt-1 line-clamp-3 text-sm leading-relaxed whitespace-pre-wrap">
                      {item.body}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          {/* Only offered when the list is full enough that something may be
              hidden behind it. */}
          {!showAll && recent.length >= RECENT_DAYS ? (
            <p className="mt-4 text-sm">
              <Link
                href="/journal?tutti=1"
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Mostra tutto il diario
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
