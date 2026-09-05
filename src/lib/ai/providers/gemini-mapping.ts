import type { AIMessage, AIToolCall, AIToolDefinition, AIToolResult } from '@/lib/ai/provider'

/**
 * Translating between our shapes and Gemini's.
 *
 * Kept apart from the HTTP call so it can be tested without a network or an
 * API key. This is where an adapter usually goes wrong - a schema the provider
 * silently rejects, a tool result sent under the wrong role - and all of those
 * failures look like "the AI is being stupid" from the outside.
 */

type JsonSchema = Record<string, unknown>

export type GeminiSchema = {
  type?: string
  nullable?: boolean
  description?: string
  enum?: unknown[]
  properties?: Record<string, GeminiSchema>
  required?: string[]
  items?: GeminiSchema
}

/** Keywords Gemini accepts. Anything else is dropped rather than sent. */
const ALLOWED = new Set(['type', 'description', 'enum', 'properties', 'required', 'items', 'format'])

/**
 * Gemini takes a subset of JSON Schema and rejects the rest outright.
 *
 * The important case is nullability: zod renders an optional field as
 * `{"type": ["string", "null"]}`, which Gemini will not accept, so a tool
 * containing one would never reach the model at all.
 */
export function toGeminiSchema(schema: JsonSchema): GeminiSchema {
  const result: GeminiSchema = {}

  for (const [key, value] of Object.entries(schema)) {
    if (!ALLOWED.has(key)) continue

    if (key === 'type') {
      if (Array.isArray(value)) {
        const types = value.filter((entry) => entry !== 'null')
        result.type = String(types[0] ?? 'string')
        if (value.length !== types.length) result.nullable = true
      } else {
        result.type = String(value)
      }
      continue
    }

    if (key === 'properties' && value && typeof value === 'object') {
      result.properties = Object.fromEntries(
        Object.entries(value as Record<string, JsonSchema>).map(([name, child]) => [
          name,
          toGeminiSchema(child),
        ]),
      )
      continue
    }

    if (key === 'items' && value && typeof value === 'object') {
      result.items = toGeminiSchema(value as JsonSchema)
      continue
    }

    Object.assign(result, { [key]: value })
  }

  return result
}

export type GeminiTool = {
  functionDeclarations: {
    name: string
    description: string
    parameters: GeminiSchema
  }[]
}

export function toGeminiTools(tools: AIToolDefinition[]): GeminiTool[] {
  if (tools.length === 0) return []

  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: toGeminiSchema(tool.parameters),
      })),
    },
  ]
}

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } }

export type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] }

export function toGeminiContents(messages: AIMessage[]): {
  systemInstruction?: { parts: { text: string }[] }
  contents: GeminiContent[]
} {
  const systemTexts: string[] = []
  const contents: GeminiContent[] = []

  for (const message of messages) {
    if (message.role === 'system') {
      systemTexts.push(message.content)
      continue
    }

    if (message.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: message.content }] })
      continue
    }

    if (message.role === 'tool') {
      // A tool result goes back as a functionResponse. Gemini wants an object,
      // not a string, so the JSON we produced is parsed back - and if it is
      // not JSON it is wrapped rather than dropped.
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: message.name,
              response: parseResponse(message.content),
            },
          },
        ],
      })
      continue
    }

    const parts: GeminiPart[] = []
    if (message.content && message.content.trim() !== '') parts.push({ text: message.content })
    for (const call of message.toolCalls ?? []) {
      parts.push({ functionCall: { name: call.name, args: call.arguments } })
    }

    // Gemini rejects a content with no parts, which is exactly what an empty
    // assistant turn produces.
    if (parts.length > 0) contents.push({ role: 'model', parts })
  }

  return {
    systemInstruction: systemTexts.length > 0
      ? { parts: [{ text: systemTexts.join('\n\n') }] }
      : undefined,
    contents,
  }
}

function parseResponse(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? parsed : { risultato: content }
  } catch {
    return { risultato: content }
  }
}

export type GeminiResponse = {
  candidates?: {
    content?: { parts?: GeminiPart[] }
  }[]
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
}

export function fromGeminiResponse(response: GeminiResponse): AIToolResult {
  const parts = response.candidates?.[0]?.content?.parts ?? []

  const texts: string[] = []
  const toolCalls: AIToolCall[] = []

  for (const [index, part] of parts.entries()) {
    if ('text' in part && part.text) texts.push(part.text)
    if ('functionCall' in part) {
      toolCalls.push({
        // Gemini assigns no id, but the loop pairs results to calls by one.
        id: `${part.functionCall.name}-${index}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args ?? {},
      })
    }
  }

  const usage = response.usageMetadata
    ? {
        inputTokens: response.usageMetadata.promptTokenCount,
        outputTokens: response.usageMetadata.candidatesTokenCount,
      }
    : undefined

  return {
    text: texts.length > 0 ? texts.join('\n') : undefined,
    toolCalls,
    usage,
  }
}
