import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Finanze · Life OS' }

export default function FinancePage() {
  return (
    <>
      <PageHeader eyebrow="Entrate e uscite" title="Finanze" />
      <EmptyState
        title="Nessun movimento registrato."
        hint="Registra la prima spesa per vedere saldo, andamento del mese e ripartizione per categoria. Il modo più rapido resta scriverlo: «ho speso 35 euro al supermercato»."
      />
    </>
  )
}
