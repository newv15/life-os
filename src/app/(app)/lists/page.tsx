import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { ListCard } from '@/components/lists/list-card'
import { ListComposer } from '@/components/lists/list-composer'
import { ListItems } from '@/components/lists/list-items'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { getList, listLists } from '@/lib/services/lists'

export const metadata: Metadata = { title: 'Liste · Life OS' }

export default async function ListsPage({ searchParams }: PageProps<'/lists'>) {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  const lists = await listLists(db, userId)

  // Which list is open lives in the URL, so a list can be linked to - from the
  // command palette, or from a message - and reopens where it was left.
  const requested = (await searchParams).lista
  const openId = typeof requested === 'string' ? requested : null
  const open = openId && lists.some((list) => list.id === openId)
    ? await getList(db, userId, openId)
    : null

  return (
    <>
      <PageHeader eyebrow="Da spuntare" title="Liste" />

      <ListComposer />

      {lists.length === 0 ? (
        <EmptyState
          title="Nessuna lista."
          hint="Creane una qui sopra, oppure dillo al bot: «aggiungi latte e pane alla spesa» — la lista la crea lui."
        />
      ) : (
        <ul>
          {lists.map((list) => (
            <ListCard key={list.id} list={list} active={list.id === openId} />
          ))}
        </ul>
      )}

      {open ? (
        <section aria-labelledby="aperta" className="mt-10">
          <h2 id="aperta" className="font-heading mb-4 text-xl">
            {open.list.name}
          </h2>

          <ListItems list={open.list} items={open.items} />
        </section>
      ) : null}
    </>
  )
}
