import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Progetti · Life OS' }

export default function ProjectsPage() {
  return (
    <>
      <PageHeader eyebrow="In corso" title="Progetti" />
      <EmptyState
        title="Nessun progetto attivo."
        hint="Un progetto raccoglie i task che servono allo stesso risultato e può essere agganciato a un obiettivo, così sai sempre a cosa stai lavorando davvero."
      />
    </>
  )
}
