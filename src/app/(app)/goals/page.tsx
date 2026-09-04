import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Obiettivi · Life OS' }

export default function GoalsPage() {
  return (
    <>
      <PageHeader eyebrow="Dove stai andando" title="Obiettivi" />
      <EmptyState
        title="Nessun obiettivo in corso."
        hint="Gli obiettivi stanno sopra progetti e task: annuali, trimestrali, mensili o settimanali. Sono quelli che rendono rispondibile la domanda «tutto questo a cosa serve?»."
      />
    </>
  )
}
