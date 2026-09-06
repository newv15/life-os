import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseConfigured,
  type Db,
  type TestUser,
} from '../helpers/supabase'
import { searchEverything } from '@/lib/services/search'
import { createTask } from '@/lib/services/tasks'
import { createPerson } from '@/lib/services/personal'
import { searchGlobalTool } from '@/lib/ai/tools/planning'

/**
 * Search crosses every table at once, which makes it the one query where a
 * missing owner filter would leak everything rather than one thing. So it is
 * tested the same way the rest of the isolation is: with a second user who
 * must see none of it.
 */

describe.skipIf(!supabaseConfigured)('global search', () => {
  const admin: Db = adminClient()
  let owner: TestUser
  let stranger: TestUser

  beforeAll(async () => {
    owner = await createTestUser(admin, 'search-owner')
    stranger = await createTestUser(admin, 'search-stranger')

    await createTask(admin, owner.id, { title: 'Portare i documenti dal commercialista' })
    await createPerson(admin, owner.id, { fullName: 'Marco Commercialista' })
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, owner.id)
    await deleteTestUser(admin, stranger.id)
  }, 60_000)

  it('finds a match across different tables in one query', async () => {
    const hits = await searchEverything(admin, owner.id, 'commercialista')

    expect(hits.map((hit) => hit.entityType).sort()).toEqual(['person', 'task'])
    expect(hits.find((hit) => hit.entityType === 'task')?.href).toMatch(/^\/tasks\?focus=/)
  })

  it('matches on part of a word, the way someone actually types mid-thought', async () => {
    const hits = await searchEverything(admin, owner.id, 'documenti')

    expect(hits.map((hit) => hit.title)).toContain('Portare i documenti dal commercialista')
  })

  it('shows another user nothing, even through the service role', async () => {
    const hits = await searchEverything(admin, stranger.id, 'commercialista')

    expect(hits).toEqual([])
  })

  describe('the search tool', () => {
    const context = (userId: string) => ({
      db: admin,
      userId,
      channel: 'telegram' as const,
      timezone: 'Europe/Rome',
      now: new Date(),
    })

    it('answers with what it found, naming the kind of each thing', async () => {
      const outcome = await searchGlobalTool.execute(context(owner.id), {
        query: 'commercialista',
      })

      expect(outcome.summary).toContain('Marco Commercialista')
      expect(outcome.summary).toContain('persona')
    })

    it('says plainly when there is nothing, instead of leaving the model to invent', async () => {
      const outcome = await searchGlobalTool.execute(context(owner.id), {
        query: 'zzzznonesiste',
      })

      expect(outcome.summary).toMatch(/niente|nulla|nessun/i)
    })
  })
})
