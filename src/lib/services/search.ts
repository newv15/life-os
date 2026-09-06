import { selectSearchResults } from '@/lib/db/repositories/search'
import type { Db, Enums } from '@/lib/db/types'

export type SearchHit = {
  entityType: Enums['entity_type']
  id: string
  title: string
  snippet: string
  href: string
  occurredAt: string | null
}

/** Where each kind of result is actually visible. */
const SCREENS: Partial<Record<Enums['entity_type'], string>> = {
  task: '/tasks',
  project: '/projects',
  goal: '/goals',
  event: '/calendar',
  transaction: '/finance',
  person: '/people',
  inbox_item: '/inbox',
}

/**
 * The link that opens a result, or null if nothing on screen shows it.
 *
 * `focus` is read by the destination page, which scrolls to the row and marks
 * it: landing on a list of forty tasks with no idea which one was the match is
 * barely better than not having searched.
 */
export function hrefForEntity(entityType: Enums['entity_type'], id: string): string | null {
  const screen = SCREENS[entityType]
  return screen ? `${screen}?focus=${id}` : null
}

/** Below two characters everything matches, which is the same as nothing matching. */
const MIN_QUERY = 2

export async function searchEverything(
  db: Db,
  userId: string,
  query: string,
  limit = 20,
): Promise<SearchHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY) return []

  const rows = await selectSearchResults(db, userId, trimmed, limit)

  return rows.flatMap((row) => {
    const href = hrefForEntity(row.entity_type, row.entity_id)
    // Kinds with no screen - memories, notes - are dropped rather than shown
    // dead: a result that cannot be opened costs a click and returns nothing.
    if (!href) return []

    return [
      {
        entityType: row.entity_type,
        id: row.entity_id,
        title: row.title ?? '(senza titolo)',
        snippet: row.snippet ?? '',
        href,
        occurredAt: row.occurred_at ?? null,
      },
    ]
  })
}
