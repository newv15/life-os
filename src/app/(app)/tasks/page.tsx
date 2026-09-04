import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Task · Life OS' }

export default function TasksPage() {
  return (
    <>
      <PageHeader eyebrow="Attività" title="Task" />
      <EmptyState
        title="Nessun task aperto."
        hint="Crea il primo task da qui, oppure dettalo al bot: «domani alle 10 devo chiamare il commercialista»."
      />
    </>
  )
}
