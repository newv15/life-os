import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { InboxCapture } from '@/components/inbox/inbox-capture'
import { InboxItem } from '@/components/inbox/inbox-item'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { listInboxItems } from '@/lib/services/inbox'

export const metadata: Metadata = { title: 'Inbox · Life OS' }

export default async function InboxPage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  const items = await listInboxItems(db, userId)

  return (
    <>
      <PageHeader eyebrow="Da smistare" title="Inbox" />

      <InboxCapture />

      {items.length === 0 ? (
        <EmptyState
          title="L'inbox è vuota."
          hint="Qui finisce tutto ciò che scrivi senza decidere subito dove metterlo: idee, appunti, cose da valutare. Le smisti quando hai tempo, non nel momento in cui ti vengono in mente."
        />
      ) : (
        <ul>
          {items.map((item) => (
            <InboxItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </>
  )
}
