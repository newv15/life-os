import type {
  AIMessage,
  AIProvider,
  AIToolDefinition,
  AIToolResult,
} from '@/lib/ai/provider'
import { AIProviderError } from '@/lib/ai/provider'

/**
 * A provider that answers from a script.
 *
 * The AI service has to be testable without a model: what is being tested is
 * the loop around the model - does a tool actually run, is it logged, does a
 * destructive one stop and ask, does a refusal reach the user without losing
 * what they typed. A real model would make those answers non-deterministic
 * while proving nothing extra.
 *
 * It also records what it was asked, so tests can assert on what the model was
 * told: whether tool results came back to it, whether the context was there.
 */
export class ScriptedProvider implements AIProvider {
  readonly name = 'scripted'

  /** Every request the service made, in order. */
  readonly requests: { messages: AIMessage[]; tools: AIToolDefinition[] }[] = []

  /** A step may be an error, to script a provider that fails partway through. */
  private readonly steps: (AIToolResult | Error)[]

  constructor(steps: (AIToolResult | Error)[]) {
    this.steps = [...steps]
  }

  async executeToolCalling(request: {
    messages: AIMessage[]
    tools: AIToolDefinition[]
  }): Promise<AIToolResult> {
    this.requests.push({ messages: request.messages, tools: request.tools })

    const next = this.steps.shift()
    if (!next) return { text: 'Non ho altro da aggiungere.', toolCalls: [] }
    if (next instanceof Error) throw next
    return next
  }

  async generateText(): Promise<{ text: string }> {
    return { text: 'testo' }
  }

  async generateStructuredOutput<T>(): Promise<T> {
    throw new Error('non usato nei test')
  }
}

/** A provider that is simply down, to exercise the degraded path. */
export class BrokenProvider implements AIProvider {
  readonly name = 'broken'

  async executeToolCalling(): Promise<never> {
    throw new AIProviderError('rate limit superato', 'broken')
  }

  async generateText(): Promise<never> {
    throw new AIProviderError('rate limit superato', 'broken')
  }

  async generateStructuredOutput<T>(): Promise<T> {
    throw new AIProviderError('rate limit superato', 'broken')
  }
}
