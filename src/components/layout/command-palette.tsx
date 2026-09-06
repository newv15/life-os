'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  Banknote,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Inbox as InboxIcon,
  Monitor,
  Moon,
  Sun,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { NAV_GROUPS, SETTINGS_ITEM, type NavItem } from '@/lib/navigation'
import { searchAction } from '@/app/(app)/search-actions'
import type { SearchHit } from '@/lib/services/search'
import type { Enums } from '@/lib/db/types'

/** Fires from anywhere - the sidebar button, the phone menu - without plumbing. */
export const OPEN_PALETTE_EVENT = 'life-os:open-palette'

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))
}

const NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM]

const RESULT_ICONS: Partial<Record<Enums['entity_type'], LucideIcon>> = {
  task: CheckSquare,
  project: FolderKanban,
  goal: Target,
  event: CalendarDays,
  transaction: Banknote,
  person: Users,
  inbox_item: InboxIcon,
}

const RESULT_LABELS: Partial<Record<Enums['entity_type'], string>> = {
  task: 'Task',
  project: 'Progetto',
  goal: 'Obiettivo',
  event: 'Appuntamento',
  transaction: 'Movimento',
  person: 'Persona',
  inbox_item: 'Inbox',
}

/** Ignores accents and case, because nobody types "perché" into a search box. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * One box for going somewhere and for finding something.
 *
 * Filtering is done here rather than by cmdk: the results arrive already
 * matched by Postgres, and a second round of fuzzy matching in the browser
 * would quietly drop rows the database judged relevant.
 */
export function CommandPalette() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Results are kept together with the question they answer. Replies come back
  // out of order, so anything that does not match what is currently typed is
  // simply not shown - which also covers the query being cleared.
  const [answer, setAnswer] = useState<{ query: string; hits: SearchHit[] }>({
    query: '',
    hits: [],
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }

    function onOpen() {
      setOpen(true)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return

    // Typing is faster than a round trip, so wait for a pause rather than
    // asking the database about every keystroke.
    const timer = setTimeout(async () => {
      const result = await searchAction(trimmed)
      setAnswer({ query: trimmed, hits: result.ok ? result.data : [] })
    }, 180)

    return () => clearTimeout(timer)
  }, [query])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery('')
      router.push(href)
    },
    [router],
  )

  const trimmed = query.trim()
  const hits = answer.query === trimmed ? answer.hits : []
  const searching = trimmed.length >= 2 && answer.query !== trimmed

  const needle = normalise(trimmed)
  const navMatches = needle
    ? NAV_ITEMS.filter((item) => normalise(item.label).includes(needle))
    : NAV_ITEMS

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Cerca e naviga"
      description="Cerca fra i tuoi dati o vai a una schermata."
    >
      {/* cmdk would otherwise filter the results a second time, in the
          browser, and drop rows Postgres had already judged relevant. */}
      <Command shouldFilter={false}>
        <CommandInput value={query} onValueChange={setQuery} placeholder="Cerca o vai a…" />
        <CommandList>
          <CommandEmpty>Nessun risultato.</CommandEmpty>

          {searching ? (
            <p className="px-3 py-2 text-xs text-muted-foreground" role="status">
              Cerco…
            </p>
          ) : null}

          {hits.length > 0 ? (
            <CommandGroup heading="Risultati">
              {hits.map((hit) => {
                const Icon = RESULT_ICONS[hit.entityType] ?? CheckSquare

                return (
                  <CommandItem
                    key={`${hit.entityType}-${hit.id}`}
                    value={`${hit.entityType}-${hit.id}`}
                    onSelect={() => go(hit.href)}
                  >
                    <Icon className="text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{hit.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {RESULT_LABELS[hit.entityType]}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ) : null}

          {navMatches.length > 0 ? (
            <CommandGroup heading="Vai a">
              {navMatches.map((item) => {
                const Icon = item.icon

                return (
                  <CommandItem key={item.href} value={item.href} onSelect={() => go(item.href)}>
                    <Icon className="text-muted-foreground" aria-hidden />
                    {item.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ) : null}

          {needle === '' ? (
            <CommandGroup heading="Aspetto">
              <CommandItem value="tema-chiaro" onSelect={() => setTheme('light')}>
                <Sun className="text-muted-foreground" aria-hidden />
                Tema chiaro
              </CommandItem>
              <CommandItem value="tema-scuro" onSelect={() => setTheme('dark')}>
                <Moon className="text-muted-foreground" aria-hidden />
                Tema scuro
              </CommandItem>
              <CommandItem value="tema-sistema" onSelect={() => setTheme('system')}>
                <Monitor className="text-muted-foreground" aria-hidden />
                Come il sistema
              </CommandItem>
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
