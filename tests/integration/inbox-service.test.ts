import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseConfigured,
  type Db,
  type TestUser,
} from '../helpers/supabase'
import {
  captureInboxItem,
  dismissInboxItem,
  listInboxItems,
  promoteInboxItemToTask,
} from '@/lib/services/inbox'
import { getTask } from '@/lib/services/tasks'
import { ValidationError } from '@/lib/services/errors'

/**
 * The inbox is the system's safety net.
 *
 * Anything that arrives without needing a decision lands here, and - once the
 * AI exists - so does anything it could not interpret. So the one property that
 * matters most is that capture never fails for a reason the person has to
 * think about: any text goes in, and sorting it out happens later.
 */

describe.skipIf(!supabaseConfigured)('inbox service', () => {
  const admin: Db = adminClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser(admin, 'inbox')
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  it('captures a note as it was written, and marks where it came from', async () => {
    const item = await captureInboxItem(
      admin,
      user.id,
      { rawText: 'Idea: un gestionale per palestre' },
      'telegram',
    )

    expect(item.raw_text).toBe('Idea: un gestionale per palestre')
    expect(item.status).toBe('pending')
    expect(item.source).toBe('telegram')
    expect(item.triaged_at).toBeNull()
  })

  it('accepts a long, messy, unpunctuated thought without complaint', async () => {
    const messy = 'boh mi è venuta in mente una cosa '.repeat(20)
    const item = await captureInboxItem(admin, user.id, { rawText: messy })

    expect(item.raw_text).toBe(messy.trim())
  })

  it('still refuses an empty capture, which is a mistake rather than a thought', async () => {
    await expect(
      captureInboxItem(admin, user.id, { rawText: '   ' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('lists only what is still waiting to be sorted', async () => {
    const pending = await captureInboxItem(admin, user.id, { rawText: 'Ancora da vedere' })
    const gone = await captureInboxItem(admin, user.id, { rawText: 'Non serviva' })
    await dismissInboxItem(admin, user.id, gone.id)

    const ids = (await listInboxItems(admin, user.id)).map((i) => i.id)

    expect(ids).toContain(pending.id)
    expect(ids).not.toContain(gone.id)
  })

  describe('promoting to a task', () => {
    it('creates the task and records what the item became', async () => {
      const item = await captureInboxItem(admin, user.id, {
        rawText: 'Chiamare il commercialista',
      })

      const task = await promoteInboxItemToTask(admin, user.id, item.id, {})

      expect(task.title).toBe('Chiamare il commercialista')

      const [remaining] = await listInboxItems(admin, user.id, 'triaged')
      const triaged = (await listInboxItems(admin, user.id, 'all')).find((i) => i.id === item.id)!

      expect(remaining).toBeDefined()
      expect(triaged.status).toBe('triaged')
      expect(triaged.triaged_at).not.toBeNull()
      expect(triaged.promoted_entity_type).toBe('task')
      expect(triaged.promoted_entity_id).toBe(task.id)
    })

    it('lets the title and due date be corrected on the way out', async () => {
      const item = await captureInboxItem(admin, user.id, { rawText: 'commercialista boh' })

      const task = await promoteInboxItemToTask(admin, user.id, item.id, {
        title: 'Chiamare il commercialista',
        dueAt: '2026-09-10T09:00',
      })

      expect(task.title).toBe('Chiamare il commercialista')
      expect(new Date(task.due_at!).toISOString()).toBe('2026-09-10T07:00:00.000Z')
    })

    it('leaves the item alone when the task cannot be created', async () => {
      // A bad due date must not consume the note: the thought is still there
      // to try again with.
      const item = await captureInboxItem(admin, user.id, { rawText: 'Qualcosa' })

      await expect(
        promoteInboxItemToTask(admin, user.id, item.id, { dueAt: 'venerdì' }),
      ).rejects.toBeInstanceOf(ValidationError)

      const untouched = (await listInboxItems(admin, user.id)).find((i) => i.id === item.id)
      expect(untouched).toBeDefined()
      expect(untouched!.status).toBe('pending')
    })

    it("will not promote another user's item", async () => {
      const other = await createTestUser(admin, 'inbox-other')
      try {
        const theirs = await captureInboxItem(admin, other.id, { rawText: 'Roba loro' })

        await expect(promoteInboxItemToTask(admin, user.id, theirs.id, {})).rejects.toThrow()

        const theirTasks = await getTask(admin, user.id, theirs.id)
        expect(theirTasks).toBeNull()
      } finally {
        await deleteTestUser(admin, other.id)
      }
    }, 60_000)
  })
})
