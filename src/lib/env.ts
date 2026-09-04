import { z } from 'zod'

/**
 * Environment access, validated once and centrally.
 *
 * Server secrets are read lazily through functions rather than at module load,
 * so importing anything from this file in a client component cannot accidentally
 * pull a secret into the browser bundle.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
})

export type PublicEnv = z.infer<typeof publicSchema>

let cachedPublicEnv: PublicEnv | null = null

/**
 * Validated on first use rather than at import time.
 *
 * Next.js evaluates modules while building, so parsing at import would turn a
 * missing variable into a failed build instead of a clear runtime error - and
 * would make the whole app unbuildable before the Supabase project exists.
 *
 * The literal `process.env.X` references matter: Next replaces them at build
 * time only when written out in full, never via dynamic lookup.
 */
export function publicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv

  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  })

  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(
      `Variabili d'ambiente Supabase mancanti o non valide: ${missing}. ` +
        'Copia .env.example in .env.local e compilalo.',
    )
  }

  cachedPublicEnv = parsed.data
  return cachedPublicEnv
}

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AI_PROVIDER: z.enum(['gemini', 'openai-compatible', 'anthropic']).default('gemini'),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().min(1),
  AI_BASE_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_ALLOWED_USER_IDS: z.string().default(''),
  CRON_SECRET: z.string().min(1),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cachedServerEnv: ServerEnv | null = null

/** Throws with a readable message if a server secret is missing or malformed. */
export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv

  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Variabili d'ambiente server mancanti o non valide: ${missing}`)
  }

  cachedServerEnv = parsed.data
  return cachedServerEnv
}

/** Telegram ids allowed to reach the bot at all, on top of the database link. */
export function allowedTelegramUserIds(): bigint[] {
  return serverEnv()
    .TELEGRAM_ALLOWED_USER_IDS.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => BigInt(s))
}
