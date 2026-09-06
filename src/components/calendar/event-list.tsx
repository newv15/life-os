'use client'

import { useTransition } from 'react'
import { MapPin, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatRelativeDay, formatTime, isOverdue } from '@/lib/utils/date'
import { deleteEventAction } from '@/app/(app)/calendar/actions'
import type { EventRow } from '@/lib/services/calendar'

/**
 * The calendar as a list, not a grid.
 *
 * A month grid is mostly empty boxes for one person's life, and on a phone it
 * is unreadable. What actually gets asked is "what's next", which a list
 * grouped by day answers directly.
 */
export function EventList({ events }: { events: EventRow[] }) {
  const byDay = new Map<string, EventRow[]>()

  for (const event of events) {
    const day = event.starts_at.slice(0, 10)
    byDay.set(day, [...(byDay.get(day) ?? []), event])
  }

  return (
    <div className="space-y-6">
      {[...byDay.entries()].map(([day, dayEvents]) => (
        <section key={day}>
          <h3 className="eyebrow mb-2">{formatRelativeDay(dayEvents[0].starts_at)}</h3>
          <ul className="spine space-y-4">
            {dayEvents.map((event) => (
              <EventRowItem key={event.id} event={event} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function EventRowItem({ event }: { event: EventRow }) {
  const [pending, startTransition] = useTransition()

  function remove() {
    startTransition(async () => {
      const result = await deleteEventAction(event.id)
      if (!result.ok) toast.error(result.error)
    })
  }

  const past = isOverdue(event.ends_at ?? event.starts_at)

  return (
    <li
      data-entity-id={event.id}
      className={cn('spine-item group', pending && 'opacity-60')}
      data-now={!past && isOverdue(event.starts_at) ? 'true' : 'false'}
    >
      <time className="spine-time" dateTime={event.starts_at}>
        {event.all_day ? 'tutto' : formatTime(event.starts_at)}
      </time>
      <span className="spine-dot" aria-hidden />

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm leading-snug', past && 'text-muted-foreground')}>
            {event.title}
          </p>
          {event.location ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden />
              {event.location}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={remove}
          aria-label={`Elimina ${event.title}`}
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  )
}
