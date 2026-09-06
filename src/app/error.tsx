'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * What a person sees when something breaks.
 *
 * No stack trace and no apology: what went wrong, that nothing was lost, and
 * two things to do about it. The digest is printed because it is the only
 * thread between this screen and the line in the server log that explains it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] errore non gestito', error)
  }, [error])

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <h1 className="font-heading text-2xl">Qui si è rotto qualcosa</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Non è colpa di quello che hai scritto, e non è andato perso niente: i dati stanno nel
        database, questa è solo la pagina che non è riuscita a mostrarli.
      </p>

      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Riprova
        </button>
        <Link
          href="/"
          className="rounded-md border border-rule px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Torna a oggi
        </Link>
      </div>

      {error.digest ? (
        <p className="data mt-8 text-xs text-muted-foreground">Riferimento: {error.digest}</p>
      ) : null}
    </div>
  )
}
