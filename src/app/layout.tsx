import type { Metadata, Viewport } from 'next'
import { Fraunces, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/layout/theme-provider'
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
  // Two entries so the phone's status bar matches the page instead of
  // stopping the dark interface with a strip of daylight.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF1EF' },
    { media: '(prefers-color-scheme: dark)', color: '#141A19' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The theme is written onto <html> before paint by a script next-themes
    // injects, so the server markup cannot match: this is the one place where
    // a hydration difference is the correct outcome.
    <html
      lang="it"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${data.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
