import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { PersonList } from '@/components/people/person-list'
import { PersonComposer } from '@/components/people/person-composer'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { listPeople } from '@/lib/services/personal'

export const metadata: Metadata = { title: 'Persone · Life OS' }

export default async function PeoplePage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  const people = await listPeople(db, userId)

  return (
    <>
      <PageHeader eyebrow="Rubrica" title="Persone" />

      <PersonComposer />

      {people.length === 0 ? (
        <EmptyState
          title="Nessun contatto."
          hint="Non è una rubrica telefonica: serve a ricordarti chi sono e soprattutto cosa devi fare con loro. Il campo che conta è «prossima cosa da fare»."
        />
      ) : (
        <PersonList people={people} />
      )}
    </>
  )
}
