'use server'

import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { searchEverything, type SearchHit } from '@/lib/services/search'

export async function searchAction(query: string): Promise<ActionResult<SearchHit[]>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    return searchEverything(db, userId, query)
  })
}
