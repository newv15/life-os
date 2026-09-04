import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils/date'

export type SpineItem = {
  id: string
  at: string | Date
  title: string
  detail?: string
  /** True for the item the user is inside right now, or the next one due. */
  now?: boolean
}

/**
 * The day, drawn as one continuous line.
 *
 * Everything scheduled hangs off a single vertical rule at its own hour, so the
 * shape of the day is readable before a single word is: where it is dense,
 * where it is empty, and how far the current moment has travelled down it.
 */
export function DaySpine({ items }: { items: SpineItem[] }) {
  if (items.length === 0) {
    return (
      <div className="spine py-2">
        <p className="text-sm text-muted-foreground">
          Nessun impegno in programma. La giornata è tua.
        </p>
      </div>
    )
  }

  return (
    <ol className="spine space-y-5 py-2">
      {items.map((item) => (
        <li key={item.id} className="spine-item" data-now={item.now ? 'true' : 'false'}>
          <time className="spine-time" dateTime={new Date(item.at).toISOString()}>
            {formatTime(item.at)}
          </time>
          <span className="spine-dot" aria-hidden />
          <p className={cn('text-sm leading-snug', item.now && 'font-medium')}>
            {item.title}
          </p>
          {item.detail ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
