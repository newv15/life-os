import type { ZodType } from 'zod'

/**
 * The seam between this application and whatever model is answering today.
 *
 * Nothing above this file knows which vendor is in use. Switching from Gemini
 * to a local model is an environment variable, not a code change - which is
 * the point: a personal system that outlives one vendor's free tier has to be
 * able to change its mind cheaply.
 *
 * The shape borrows from the tool-calling conventions every provider has
 * converged on, so adapters translate rather than reinvent.
 */

export type AIRole = 'system' | 'user' | 'assistant' | 'tool'

export type AIToolCall = {
  /** Provider-assigned, or synthesised by the adapter when it gives none. */
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type AIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content?: string; toolCalls?: AIToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string }

/** A tool as the model sees it: a name, a purpose, and a JSON Schema. */
export type AIToolDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type AIUsage = { inputTokens?: number; outputTokens?: number }

export type AITextResult = { text: string; usage?: AIUsage }

export type AIToolResult = {
  /** What the model said alongside its tool calls, if anything. */
  text?: string
  toolCalls: AIToolCall[]
  usage?: AIUsage
}

export interface AIProvider {
  /** Identifies the adapter in logs, never the model version. */
  readonly name: string

  generateText(request: {
    messages: AIMessage[]
    maxOutputTokens?: number
    temperature?: number
  }): Promise<AITextResult>

  generateStructuredOutput<T>(request: {
    messages: AIMessage[]
    schema: ZodType<T>
    schemaName?: string
  }): Promise<T>

  executeToolCalling(request: {
    messages: AIMessage[]
    tools: AIToolDefinition[]
    maxOutputTokens?: number
  }): Promise<AIToolResult>
}

/**
 * Raised when the model cannot be reached or refuses to answer.
 *
 * Separated from ordinary errors because the caller has a specific duty when
 * it happens: tell the truth, and park the user's words in the inbox rather
 * than losing them.
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}
