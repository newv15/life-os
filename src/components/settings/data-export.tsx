import { Download } from 'lucide-react'
import { CSV_TABLES } from '@/lib/services/export'

/**
 * Plain links, on purpose.
 *
 * A download is the one thing the browser does better than any code we could
 * write, and doing it through a link means the file arrives even if JavaScript
 * has not.
 */
export function DataExport() {
  return (
    <div className="mt-4 space-y-4">
      <a
        href="/api/export?format=json"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Download className="size-4" aria-hidden />
        Scarica tutto (JSON)
      </a>

      <div>
        <p className="eyebrow mb-2">Per il foglio di calcolo</p>
        <ul className="flex flex-wrap gap-2">
          {CSV_TABLES.map((entry) => (
            <li key={entry.table}>
              <a
                href={`/api/export?format=csv&table=${entry.table}`}
                className="inline-flex items-center gap-2 rounded-md border border-rule px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {entry.label}
                <span className="data text-[0.6875rem] uppercase">csv</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
