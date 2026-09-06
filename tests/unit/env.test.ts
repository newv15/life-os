import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aiEnv, cronEnv, isAIConfigured, isTelegramConfigured, telegramEnv } from '@/lib/env'

/**
 * Configuration is checked in groups, not all at once.
 *
 * The first version validated every server variable together, which meant the
 * AI refused to start until a Telegram bot token existed - two features that
 * have nothing to do with each other. Worse, it made the app unusable during
 * exactly the period when you are configuring it one piece at a time.
 */

const KEYS = [
  'AI_PROVIDER',
  'AI_API_KEY',
  'AI_MODEL',
  'AI_BASE_URL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'TELEGRAM_ALLOWED_USER_IDS',
  'CRON_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
] as const

let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]))
  for (const key of KEYS) delete process.env[key]
})

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('aiEnv', () => {
  it('works with only the AI variables set', () => {
    process.env.AI_PROVIDER = 'gemini'
    process.env.AI_API_KEY = 'chiave'
    process.env.AI_MODEL = 'gemini-2.5-flash'

    expect(aiEnv().AI_MODEL).toBe('gemini-2.5-flash')
  })

  it('does not care that Telegram is unconfigured', () => {
    process.env.AI_API_KEY = 'chiave'
    process.env.AI_MODEL = 'gemini-2.5-flash'

    expect(() => aiEnv()).not.toThrow()
  })

  it('names what is missing rather than failing vaguely', () => {
    expect(() => aiEnv()).toThrowError(/AI_API_KEY/)
  })

  it('defaults the provider to gemini', () => {
    process.env.AI_API_KEY = 'chiave'
    process.env.AI_MODEL = 'm'

    expect(aiEnv().AI_PROVIDER).toBe('gemini')
  })
})

describe('telegramEnv', () => {
  it('works with only the Telegram variables set', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token'
    process.env.TELEGRAM_WEBHOOK_SECRET = 'segreto'

    expect(telegramEnv().TELEGRAM_BOT_TOKEN).toBe('token')
  })

  it('does not care that the AI is unconfigured', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token'
    process.env.TELEGRAM_WEBHOOK_SECRET = 'segreto'

    expect(() => telegramEnv()).not.toThrow()
  })

  it('reads the allowlist as numbers', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token'
    process.env.TELEGRAM_WEBHOOK_SECRET = 'segreto'
    process.env.TELEGRAM_ALLOWED_USER_IDS = ' 123 , 456 '

    expect(telegramEnv().allowedUserIds).toEqual([BigInt(123), BigInt(456)])
  })

  it('treats an empty allowlist as no extra restriction', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token'
    process.env.TELEGRAM_WEBHOOK_SECRET = 'segreto'

    expect(telegramEnv().allowedUserIds).toEqual([])
  })
})

describe('cronEnv', () => {
  it('needs only its own secret', () => {
    process.env.CRON_SECRET = 'segreto'
    expect(cronEnv().CRON_SECRET).toBe('segreto')
  })
})

describe('asking whether something is configured', () => {
  it('answers without throwing when it is not', () => {
    expect(isAIConfigured()).toBe(false)
    expect(isTelegramConfigured()).toBe(false)
  })

  it('answers yes once the variables are there', () => {
    process.env.AI_API_KEY = 'chiave'
    process.env.AI_MODEL = 'm'
    process.env.TELEGRAM_BOT_TOKEN = 'token'
    process.env.TELEGRAM_WEBHOOK_SECRET = 'segreto'

    expect(isAIConfigured()).toBe(true)
    expect(isTelegramConfigured()).toBe(true)
  })
})

describe('publicEnv', () => {
  /**
   * A variable that is declared but left blank is what a half-filled
   * environment panel produces, and this one is not even read anywhere - yet
   * blank made zod reject the whole public group, which is where the Supabase
   * url and key live. One unused field left empty would take down every screen
   * in the app with "Configurazione Supabase incompleta".
   */
  it('treats a blank app url as unset rather than breaking every Supabase client', async () => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://esempio.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.NEXT_PUBLIC_APP_URL = ''

    const { publicEnv } = await import('@/lib/env')

    expect(publicEnv().NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000')
    expect(publicEnv().NEXT_PUBLIC_SUPABASE_URL).toBe('https://esempio.supabase.co')
  })
})
