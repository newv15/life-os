import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = { title: 'Impostazioni · Life OS' }

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Configurazione" title="Impostazioni" />
      <EmptyState
        title="Niente da configurare, per ora."
        hint="Da qui collegherai Telegram, sceglierai quali riepiloghi ricevere e potrai esportare tutti i tuoi dati in JSON o CSV."
      />
    </>
  )
}
