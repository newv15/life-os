import { ZodError, type ZodType } from 'zod'

/**
 * The error vocabulary every service speaks.
 *
 * There are three callers - web forms, AI tools, and the cron tick - and each
 * needs to tell "you typed something wrong" apart from "that row is gone" and
 * "the database refused this". Typed errors let each surface answer in its own
 * register without re-deriving what went wrong from a message string.
 */

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = new.target.name
  }
}

/** Input failed validation. `issues` is keyed by field, ready for a form. */
export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly issues: Record<string, string> = {},
  ) {
    super(message, 'validation')
  }
}

/** The row does not exist, or belongs to someone else - deliberately the same
 *  answer, so this never becomes a way to probe what other users own. */
export class NotFoundError extends AppError {
  constructor(message = 'Elemento non trovato.') {
    super(message, 'not_found')
  }
}

/** The database refused the write: a broken link, a duplicate, a constraint. */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'conflict')
  }
}

/** Validates, or throws a ValidationError carrying per-field messages. */
export function parseOrThrow<T extends ZodType>(schema: T, input: unknown): ReturnType<T['parse']> {
  const result = schema.safeParse(input)
  if (result.success) return result.data as ReturnType<T['parse']>

  throw new ValidationError('Dati non validi.', fieldIssues(result.error))
}

function fieldIssues(error: ZodError): Record<string, string> {
  const issues: Record<string, string> = {}
  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_'
    // First message per field: a form shows one line, not a stack of them.
    if (!(field in issues)) issues[field] = issue.message
  }
  return issues
}

type PostgrestLikeError = { code?: string; message?: string; details?: string | null }

/**
 * Turns a Postgrest error into something a person can act on.
 *
 * 23503 is the one that matters most here: the composite foreign keys mean a
 * cross-user link fails as a foreign key violation rather than silently
 * writing a row that points nowhere.
 */
export function translateDbError(error: PostgrestLikeError, context: string): AppError {
  switch (error.code) {
    case '23503':
      return new ConflictError(
        `${context}: uno degli elementi collegati non esiste o non è tuo.`,
      )
    case '23505':
      return new ConflictError(`${context}: esiste già un elemento con questo nome.`)
    case '23514':
      return new ConflictError(`${context}: i dati non rispettano un vincolo del database.`)
    case 'PGRST116':
      return new NotFoundError()
    default:
      return new AppError(`${context}: ${error.message ?? 'errore del database'}.`, 'database')
  }
}
