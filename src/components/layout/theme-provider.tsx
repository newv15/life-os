'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * Follows the device by default.
 *
 * A system used morning and night should be light in the morning and dark at
 * night without being asked, so "system" is the default and the explicit
 * choice is there for when the device gets it wrong.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // The colours are the whole interface, so cross-fading them on a switch
      // reads as a glitch rather than as a transition.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
