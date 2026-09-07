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
  addItems,
  clearChecked,
  createList,
  deleteList,
  getList,
  listLists,
  setItemChecked,
} from '@/lib/services/lists'
import { ConflictError, NotFoundError } from '@/lib/services/errors'

/**
 * The list module, from the outside.
 *
 * Most of what matters here is about names and about emptying: the assistant
 * finds a list by what it is called, so two lists with the same name in
 * different cases would be a coin toss, and a list that empties itself must
 * never empty one that is meant to keep what it holds.
 */

describe.skipIf(!supabaseConfigured)('list service', () => {
  const admin: Db = adminClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser(admin, 'lists')
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  it('crea la lista al volo quando non esiste, e lo dice', async () => {
    const outcome = await addItems(admin, user.id, {
      listName: 'Spesa',
      items: ['Latte', 'Pane'],
    })

    expect(outcome.createdList).toBe(true)
    expect(outcome.items.map((item) => item.text)).toEqual(['Latte', 'Pane'])
  })

  it('riusa la lista esistente invece di crearne una seconda', async () => {
    const outcome = await addItems(admin, user.id, { listName: 'spesa', items: ['Caffè'] })

    // Il nome è unico senza distinzione di maiuscole: «spesa» e «Spesa» sono la
    // stessa lista, altrimenti l'assistente ne creerebbe una nuova a ogni frase
    // detta in modo leggermente diverso.
    expect(outcome.createdList).toBe(false)

    const liste = await listLists(admin, user.id)
    expect(liste.filter((list) => list.name.toLowerCase() === 'spesa')).toHaveLength(1)
  })

  it('mette le voci nuove in fondo, nell ordine in cui sono state dette', async () => {
    const { list } = await addItems(admin, user.id, {
      listName: 'Valigia',
      items: ['Passaporto', 'Caricabatterie'],
    })
    await addItems(admin, user.id, { listName: 'Valigia', items: ['Spazzolino'] })

    const { items } = await getList(admin, user.id, list.id)
    expect(items.map((item) => item.text)).toEqual([
      'Passaporto',
      'Caricabatterie',
      'Spazzolino',
    ])
  })

  it('conta quante voci restano da spuntare', async () => {
    const { list, items } = await addItems(admin, user.id, {
      listName: 'Ufficio',
      items: ['Toner', 'Risme'],
    })
    await setItemChecked(admin, user.id, items[0].id, true)

    const summary = (await listLists(admin, user.id)).find((entry) => entry.id === list.id)
    expect(summary).toMatchObject({ total: 2, checked: 1 })
  })

  it('registra quando una voce è stata spuntata, e lo dimentica se la riapri', async () => {
    const { items } = await addItems(admin, user.id, { listName: 'Prova', items: ['Una cosa'] })

    const spuntata = await setItemChecked(admin, user.id, items[0].id, true)
    expect(spuntata.checked_at).not.toBeNull()

    const riaperta = await setItemChecked(admin, user.id, items[0].id, false)
    expect(riaperta.checked_at).toBeNull()
  })

  it('svuota le spuntate e lascia stare il resto', async () => {
    const { list, items } = await addItems(admin, user.id, {
      listName: 'Da svuotare',
      items: ['Fatta', 'Da fare'],
    })
    await setItemChecked(admin, user.id, items[0].id, true)

    const tolte = await clearChecked(admin, user.id, list.id)

    expect(tolte).toBe(1)
    const { items: rimaste } = await getList(admin, user.id, list.id)
    expect(rimaste.map((item) => item.text)).toEqual(['Da fare'])
  })

  it('rifiuta di svuotare una lista che tiene lo storico', async () => {
    const list = await createList(admin, user.id, { name: 'Film visti', keepsHistory: true })
    const { items } = await addItems(admin, user.id, { listName: 'Film visti', items: ['Dune'] })
    await setItemChecked(admin, user.id, items[0].id, true)

    // Lo storico è il motivo per cui quella lista esiste: svuotarla su richiesta
    // generica sarebbe cancellarne il contenuto, non riordinarlo.
    await expect(clearChecked(admin, user.id, list.id)).rejects.toThrow(ConflictError)
  })

  it('non tocca le liste di prima quando ne cancella una', async () => {
    const list = await createList(admin, user.id, { name: 'Usa e getta' })
    await addItems(admin, user.id, { listName: 'Usa e getta', items: ['Qualcosa'] })

    await deleteList(admin, user.id, list.id)

    // Le voci se ne vanno con la lista: una voce orfana non significa niente.
    await expect(getList(admin, user.id, list.id)).rejects.toThrow(NotFoundError)
    expect((await listLists(admin, user.id)).some((entry) => entry.name === 'Spesa')).toBe(true)
  })

  it('non spunta una voce che non esiste', async () => {
    await expect(
      setItemChecked(admin, user.id, '11111111-1111-4111-8111-111111111111', true),
    ).rejects.toThrow(NotFoundError)
  })
})
