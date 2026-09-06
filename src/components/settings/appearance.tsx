'use client'

import { useTheme } from 'next-themes'
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClientValue } from '@/hooks/use-client-value'

const OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Chiaro', icon: Sun },
  { value: 'dark', label: 'Scuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

export function Appearance() {
  const { theme, setTheme } = useTheme()

  // Which one is selected is only known in the browser, so the control renders
  // with nothing selected until then rather than guessing and correcting
  // itself a moment later.
  const ready = useClientValue(() => true, false)

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="mt-3 inline-flex rounded-md border border-rule p-0.5"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const selected = ready && theme === option.value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              selected
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
