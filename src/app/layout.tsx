import type { Metadata, Viewport } from 'next'
import { Fraunces, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const display = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
})

const body = Instrument_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
})

const data = JetBrains_Mono({
  variable: '--font-data',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Life OS',
  description: 'Il tuo sistema operativo personale.',
}

export const viewport: Viewport = {
  themeColor: '#EEF1EF',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="it"
      className={`${display.variable} ${body.variable} ${data.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
