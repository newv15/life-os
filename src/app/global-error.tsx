'use client'

/**
 * The last resort: the root layout itself failed, so there is no theme, no
 * font and no shell to render inside - this file has to bring its own document.
 * Styles are inline for the same reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#EEF1EF',
          color: '#22302E',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Life OS non è riuscito ad avviarsi</h1>
          <p style={{ marginTop: '0.75rem', lineHeight: 1.6, opacity: 0.75 }}>
            I dati sono al sicuro nel database. Ricarica: se succede di nuovo, il problema è nel
            deploy, non in quello che hai scritto.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#2A5C63',
              color: '#F7F9F7',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Ricarica
          </button>
          {error.digest ? (
            <p style={{ marginTop: '2rem', fontSize: '0.75rem', opacity: 0.6 }}>
              Riferimento: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  )
}
