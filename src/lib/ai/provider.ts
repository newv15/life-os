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
  /**
   * Provider state to hand back verbatim when this call is replayed.
   *
   * Gemini 3 issues a "thought signature" with every function call and rejects
   * the next request if it is not returned with it. Nothing above the adapter
   * should read this - it is carried, not understood.
   */
  opaque?: unknown
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

/**
 * A file for the model to read: audio, an image.
 *
 * Base64 because that is the wire format every provider expects, and because
 * these never touch disk - the bytes arrive from Telegram, go to the model,
 * and are gone. What is kept is what the model made of them.
 */
export type AIMedia = {
  data: string
  /** As Telegram reported it: audio/ogg, image/jpeg. */
  mimeType: string
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

  /**
   * Turns a file into words, so that everything above this layer keeps dealing
   * in text.
   *
   * Deliberately separate from executeToolCalling rather than an attachment on
   * a message. Two reasons, one practical and one about trust: providers do not
   * agree on whether audio and function calling may travel together, and a
   * transcription the person never sees is a transcription they cannot correct
   * before it becomes an expense.
   *
   * Required on the interface, not optional: an adapter that cannot read files
   * has to say so out loud, which is a sentence the bot can repeat.
   */
  describeMedia(request: {
    media: AIMedia
    /** What to make of it - transcribe, read the receipt, list the tasks. */
    prompt: string
    maxOutputTokens?: number
  }): Promise<AITextResult>
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
