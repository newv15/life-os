import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Inbox · Life OS' }

export default function InboxPage() {
  return (
    <>
      <PageHeader eyebrow="Da smistare" title="Inbox" />
      <EmptyState
        title="L'inbox è vuota."
        hint="Qui finisce tutto ciò che scrivi senza decidere subito dove metterlo: idee, appunti, cose da valutare. Le smisti quando hai tempo, non nel momento in cui ti vengono in mente."
      />
    </>
  )
}
