import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { JournalEditor } from '@/components/journal/journal-editor'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { getJournalEntry, listJournalEntries } from '@/lib/services/personal'
import { formatLongDate, todayISO } from '@/lib/utils/date'

export const metadata: Metadata = { title: 'Diario · Life OS' }

export default async function JournalPage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()
  const today = todayISO()

  const [entry, recent] = await Promise.all([
    getJournalEntry(db, userId, today),
    listJournalEntries(db, userId, 14),
  ])

  const past = recent.filter((item) => item.entry_date !== today)

  return (
    <>
      <PageHeader eyebrow={formatLongDate()} title="Diario" />

      <JournalEditor date={today} entry={entry} />

      {past.length > 0 ? (
        <section aria-labelledby="precedenti" className="mt-10">
          <h2 id="precedenti" className="eyebrow mb-3">
            Giorni precedenti
          </h2>
          <ul className="space-y-4">
            {past.map((item) => (
              <li key={item.id} className="border-l-2 border-rule pl-4">
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
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
