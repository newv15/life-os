import { formatEUR } from '@/lib/utils/currency'
import type { CategoryRow } from '@/lib/services/finance'

type Slice = { categoryId: string | null; total: number }

/**
 * Where the money went, biggest first.
 *
 * The bar is drawn against the largest category rather than against the month's
 * total, because the question this answers is "what is eating the money",
 * and the comparison that makes it legible is between the categories
 * themselves. The share of the total is written next to it for the same reason
 * a bar alone is never enough: you cannot read 31% off a rectangle.
 *
 * Expenses only. Mixing income in would make the bars meaningless - a salary
 * dwarfs every category and flattens all of them into slivers.
 */
export function CategoryBreakdown({
  slices,
  categories,
  total,
}: {
  slices: Slice[]
  categories: CategoryRow[]
  total: number
}) {
  if (slices.length === 0) return null

  const names = new Map(categories.map((category) => [category.id, category.name]))
  const largest = slices[0].total

  return (
    <section aria-labelledby="per-categoria" className="mb-8">
      <h2 id="per-categoria" className="eyebrow mb-3">
        Dove sono andati
      </h2>

      <ul className="space-y-2">
        {slices.map((slice) => {
          const share = total > 0 ? Math.round((slice.total / total) * 100) : 0

          return (
            <li key={slice.categoryId ?? 'senza'}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {slice.categoryId ? (names.get(slice.categoryId) ?? 'Categoria rimossa') : 'Senza categoria'}
                </span>
                <span className="data shrink-0 text-muted-foreground">
                  {formatEUR(slice.total)}
                  <span className="ml-2 text-xs">{share}%</span>
                </span>
              </div>

              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${largest > 0 ? (slice.total / largest) * 100 : 0}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
