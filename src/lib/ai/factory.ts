import 'server-only'

import { aiEnv } from '@/lib/env'
import type { AIProvider } from '@/lib/ai/provider'
import { GeminiProvider } from '@/lib/ai/providers/gemini'
import { OpenAICompatibleProvider } from '@/lib/ai/providers/openai-compatible'

/**
 * The only place a vendor is named.
 *
 * Everything above this reads `AIProvider`, so moving from Gemini to Groq, to
 * a local Ollama, or to a paid model is four environment variables and a
 * redeploy. That is not architectural taste - a personal system meant to last
 * has to survive a free tier being withdrawn without being rewritten.
 */
export function createAIProvider(): AIProvider {
  const env = aiEnv()

  switch (env.AI_PROVIDER) {
    case 'gemini':
      return new GeminiProvider(env.AI_API_KEY, env.AI_MODEL, env.AI_BASE_URL)

    case 'openai-compatible':
      if (!env.AI_BASE_URL) {
        throw new Error(
          "AI_PROVIDER=openai-compatible richiede AI_BASE_URL (es. https://api.groq.com/openai/v1).",
        )
      }
      return new OpenAICompatibleProvider(env.AI_API_KEY, env.AI_MODEL, env.AI_BASE_URL)

    case 'anthropic':
      throw new Error(
        "L'adapter Anthropic non è ancora implementato. Usa gemini oppure openai-compatible.",
      )

    default: {
      // Unreachable while the enum and this switch agree; kept so adding a
      // provider to the enum without an adapter fails loudly instead of
      // falling through to a default vendor.
      const unhandled: never = env.AI_PROVIDER
      throw new Error(`Provider AI non gestito: ${String(unhandled)}`)
    }
  }
}
