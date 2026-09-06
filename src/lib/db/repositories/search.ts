import { translateDbError } from '@/lib/services/errors'
import type { Db, Enums } from '@/lib/db/types'

export type SearchRow = {
  entity_type: Enums['entity_type']
  entity_id: string
  title: string | null
  snippet: string | null
  occurred_at: string | null
  rank: number | null
}

/**
 * One call, every searchable table.
 *
 * The union lives in the database (`global_search`) rather than here: eight
 * round trips to rank eight lists in JavaScript would be slower and would rank
 * worse, since only Postgres can compare the similarity scores across tables.
 */
export async function selectSearchResults(
  db: Db,
  userId: string,
  query: string,
  limit: number,
): Promise<SearchRow[]> {
  const { data, error } = await db.rpc('global_search', {
    p_user_id: userId,
    p_query: query,
    p_limit: limit,
  })

  if (error) throw translateDbError(error, 'Ricerca non riuscita')
  return (data ?? []) as SearchRow[]
}
