'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/** How long the mark stays before the row goes back to looking like the rest. */
const FLASH_MS = 2400

/**
 * Takes you to the row you searched for, not just to the screen it lives on.
 *
 * Landing on a list of forty tasks knowing one of them was the match is barely
 * better than not having searched, so the destination scrolls to the row and
 * marks it for a couple of seconds. It works off `data-entity-id`, which every
 * list renders, rather than off anchors: the same result can be reached from
 * the palette, from a notification, or from a link in a reply.
 */
export function FocusHighlight() {
  const params = useSearchParams()
  const focus = params.get('focus')

  useEffect(() => {
    if (!focus) return

    let attempts = 0
    let timer: ReturnType<typeof setTimeout>

    function mark() {
      const target = document.querySelector<HTMLElement>(`[data-entity-id="${CSS.escape(focus!)}"]`)

      // The list may still be streaming in when this first runs, so try again
      // for a moment before giving up rather than scrolling to nothing.
      if (!target) {
        attempts += 1
        if (attempts < 20) timer = setTimeout(mark, 100)
        return
      }

      target.dataset.focused = 'true'

      // Instant, not smooth. A smooth scroll started on a page that has just
      // loaded gets cancelled by the browser's own scroll restoration, which
      // leaves the row marked somewhere off screen - and animating a jump the
      // person asked for buys nothing anyway.
      target.scrollIntoView({ block: 'center' })

      timer = setTimeout(() => {
        delete target.dataset.focused

        // Only now is the parameter dropped, so that a refresh - or the back
        // button - does not flash the same row again as if something had
        // happened. It waits until the end because changing the URL re-renders
        // the page, and a re-render mid-flash throws away the mark, which is
        // set on the element rather than held in React state.
        //
        // Written straight onto the history entry rather than through the
        // router: this URL has served its purpose, it is not a navigation.
        const url = new URL(window.location.href)
        url.searchParams.delete('focus')
        window.history.replaceState(window.history.state, '', url)
      }, FLASH_MS)
    }

    mark()
    return () => clearTimeout(timer)
  }, [focus])

  return null
}
