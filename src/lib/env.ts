import { z, type ZodType } from 'zod'

/**
 * Environment access, validated in groups.
 *
 * Grouping matters more than it looks. Validating every server variable at
 * once meant the AI refused to start until a Telegram bot token existed, and
 * the app was unusable during exactly the period when you configure it one
 * piece at a time. Each feature now checks only what it needs, when it needs
 * it, and says which variable is missing.
 *
 * Nothing is validated at import time either: Next evaluates modules while
 * building, so parsing at import turns a missing variable into a failed build
 * instead of a clear runtime error.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
})

export type PublicEnv = z.infer<typeof publicSchema>

let cachedPublicEnv: PublicEnv | null = null

/**
 * The literal `process.env.X` references matter: Next replaces them at build
 * time only when written out in full, never via a dynamic lookup.
 */
export function publicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv

  cachedPublicEnv = parse(
    publicSchema,
    // Through readOptional like every other group: a variable declared and
    // left blank - which is what a half-filled environment panel produces -
    // has to count as absent, or the default never applies and one empty
    // optional field takes down every screen that needs Supabase.
    readOptional(
      {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      },
      ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_APP_URL'],
    ),
    'Supabase',
  )

  return cachedPublicEnv
}

// --- Supabase (server) -------------------------------------------------------

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

export function serverEnv() {
  return parse(serverSchema, process.env, 'Supabase (server)')
}

// --- AI ----------------------------------------------------------------------

const aiSchema = z.object({
  AI_PROVIDER: z.enum(['gemini', 'openai-compatible', 'anthropic']).default('gemini'),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().min(1),
  AI_BASE_URL: z.string().url().optional(),
})

export type AIEnv = z.infer<typeof aiSchema>

export function aiEnv(): AIEnv {
  return parse(aiSchema, readOptional(process.env, ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL']), 'AI')
}

/** Answers without throwing, so the UI can hide what is not set up yet. */
export function isAIConfigured(): boolean {
  return succeeds(() => aiEnv())
}

// --- Telegram ----------------------------------------------------------------

const telegramSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_ALLOWED_USER_IDS: z.string().default(''),
})

export type TelegramEnv = z.infer<typeof telegramSchema> & { allowedUserIds: bigint[] }

export function telegramEnv(): TelegramEnv {
  const env = parse(
    telegramSchema,
    readOptional(process.env, [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_WEBHOOK_SECRET',
      'TELEGRAM_ALLOWED_USER_IDS',
    ]),
    'Telegram',
  )

  return {
    ...env,
    // A second barrier on top of the database link. Empty means the link is
    // the only check, which is already an identity check rather than a name.
    allowedUserIds: env.TELEGRAM_ALLOWED_USER_IDS.split(',')
      .map((value) => value.trim())
      .filter((value) => value !== '')
      .map((value) => BigInt(value)),
  }
}

export function isTelegramConfigured(): boolean {
  return succeeds(() => telegramEnv())
}

// --- Scheduler ---------------------------------------------------------------

const cronSchema = z.object({
  CRON_SECRET: z.string().min(1),
})

export function cronEnv() {
  return parse(cronSchema, readOptional(process.env, ['CRON_SECRET']), 'Scheduler')
}

// --- internals ---------------------------------------------------------------

/**
 * Reads only the named keys, treating blank as absent.
 *
 * A variable declared but left empty - which is what copying .env.example
 * produces - has to count as missing, or zod happily accepts "" and the
 * failure moves to the first API call.
 */
function readOptional(
  source: Record<string, string | undefined>,
  keys: string[],
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value.trim() !== '') result[key] = value
  }
  return result
}

function parse<T extends ZodType>(schema: T, source: unknown, group: string): z.infer<T> {
  const result = schema.safeParse(source)
  if (result.success) return result.data

  const missing = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
  throw new Error(
    `Configurazione ${group} incompleta: mancano o non sono valide ${missing}. ` +
      'Controlla .env.local (o le variabili su Vercel).',
  )
}

function succeeds(check: () => unknown): boolean {
  try {
    check()
    return true
  } catch {
    return false
  }
}
