import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <h1 className="font-heading text-2xl">Questa pagina non esiste</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Forse la cosa che cercavi è stata eliminata, oppure il link è vecchio.
      </p>

      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Torna a oggi
      </Link>
    </div>
  )
}
