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
  addToListTool,
  checkListItemTool,
  clearCheckedTool,
  showListTool,
} from '@/lib/ai/tools/lists'
import { listLists } from '@/lib/services/lists'

/**
 * The four sentences this module exists for.
 *
 * The screen is the smaller half: the point of lists is saying "aggiungi latte
 * e pane alla spesa" while walking. So what is tested here is what the
 * assistant is told back - because that echo is the only thing standing
 * between a misheard word and a list nobody will look at.
 */

describe.skipIf(!supabaseConfigured)('list tools', () => {
  const admin: Db = adminClient()
  let user: TestUser

  const context = (userId: string) => ({
    db: admin,
    userId,
    channel: 'telegram' as const,
    timezone: 'Europe/Rome',
    now: new Date(),
  })

  beforeAll(async () => {
    user = await createTestUser(admin, 'list-tools')
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  it('aggiunge più voci in un colpo e dice dove le ha messe', async () => {
    const outcome = await addToListTool.execute(context(user.id), {
      listName: 'Spesa',
      items: ['Latte', 'Pane', 'Caffè'],
    })

    expect(outcome.summary).toContain('Spesa')
    expect(outcome.summary).toMatch(/latte/i)
  })

  it('dice esplicitamente quando la lista non esisteva', async () => {
    // Creare un contenitore vuoto non è inventare un dato, ma deve restare
    // visibile: è l'unico modo per accorgersi di un nome capito male.
    const outcome = await addToListTool.execute(context(user.id), {
      listName: 'Regali di Natale',
      items: ['Sciarpa'],
    })

    expect(outcome.summary).toMatch(/creat/i)
  })

  it('non annuncia una creazione quando la lista era già lì', async () => {
    const outcome = await addToListTool.execute(context(user.id), {
      listName: 'spesa',
      items: ['Burro'],
    })

    expect(outcome.summary).not.toMatch(/creat/i)
  })

  it('spunta la voce giusta partendo da come la persona la nomina', async () => {
    await addToListTool.execute(context(user.id), {
      listName: 'Casa',
      items: ['Comprare il pane', 'Chiamare il tecnico'],
    })

    const outcome = await checkListItemTool.execute(context(user.id), {
      listName: 'Casa',
      item: 'pane',
    })

    expect(outcome.summary).toMatch(/pane/i)

    const casa = (await listLists(admin, user.id)).find((list) => list.name === 'Casa')
    expect(casa?.checked).toBe(1)
  })

  it('non spunta niente a caso quando non capisce quale voce', async () => {
    await addToListTool.execute(context(user.id), { listName: 'Ufficio', items: ['Toner'] })

    // Spuntare la cosa sbagliata è peggio che non spuntare: la voce sparisce
    // dalla vista e quella vera resta lì credendo di essere fatta.
    await expect(
      checkListItemTool.execute(context(user.id), { listName: 'Ufficio', item: 'banane' }),
    ).rejects.toThrow()
  })

  it('non inventa una lista quando le viene chiesto di leggerne una che non c è', async () => {
    await expect(
      showListTool.execute(context(user.id), { listName: 'Non esiste' }),
    ).rejects.toThrow()
  })

  it('elenca le liste quando non gliene viene nominata una', async () => {
    const outcome = await showListTool.execute(context(user.id), {})

    expect(outcome.summary).toMatch(/spesa/i)
  })

  it('legge una lista dicendo cosa resta da fare', async () => {
    const outcome = await showListTool.execute(context(user.id), { listName: 'Casa' })

    expect(outcome.summary).toMatch(/tecnico/i)
  })

  it('svuota le spuntate e dice quante ne ha tolte', async () => {
    const outcome = await clearCheckedTool.execute(context(user.id), { listName: 'Casa' })

    expect(outcome.summary).toMatch(/1|una/i)

    const casa = (await listLists(admin, user.id)).find((list) => list.name === 'Casa')
    expect(casa).toMatchObject({ total: 1, checked: 0 })
  })
})
