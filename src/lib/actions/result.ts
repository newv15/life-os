import { AppError } from '@/lib/services/errors'

/**
 * What a Server Action hands back to a form.
 *
 * Services throw typed errors; the UI needs a value it can render. This is the
 * one place that translation happens, so no action reinvents it and no
 * unexpected failure reaches the user as a stack trace.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues?: Record<string, string> }

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false,
        error: error.message,
        issues: 'issues' in error ? (error.issues as Record<string, string>) : undefined,
      }
    }

    // Anything unrecognised is a bug, not something the user did. Log it for
    // us, and say something true but unrevealing to them.
    console.error('[action] errore non gestito', error)
    return { ok: false, error: 'Qualcosa è andato storto. Riprova.' }
  }
}
