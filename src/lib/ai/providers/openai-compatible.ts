import { z, type ZodType } from 'zod'
import {
  AIProviderError,
  type AIMessage,
  type AIProvider,
  type AIToolDefinition,
  type AIToolResult,
} from '@/lib/ai/provider'

/**
 * Everything that speaks the OpenAI chat-completions dialect.
 *
 * One adapter covers Groq, OpenRouter, Together, LM Studio and Ollama, because
 * they all copied the same request shape. That is the practical reason this
 * abstraction earns its keep: the escape hatch from a free tier that changes
 * its mind is a base URL and a model name, not a rewrite.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name = 'openai-compatible'

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async executeToolCalling(request: {
    messages: AIMessage[]
    tools: AIToolDefinition[]
    maxOutputTokens?: number
  }): Promise<AIToolResult> {
    const body = {
      model: this.model,
      messages: toOpenAIMessages(request.messages),
      tools: request.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      max_tokens: request.maxOutputTokens ?? 2048,
    }

    const response = await this.post(body)
    const choice = response.choices?.[0]?.message

    return {
      text: choice?.content ?? undefined,
      toolCalls: (choice?.tool_calls ?? []).map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: safeParseArguments(call.function.arguments),
      })),
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : undefined,
    }
  }

  /**
   * Not supported, and said plainly.
   *
   * The OpenAI shape does carry images, but this one adapter stands in for
   * Groq, OpenRouter, Ollama and LM Studio, which disagree on what they accept
   * and on how audio is passed - and several accept an image and answer as if
   * they had looked. Refusing here means the bot can say "questo modello non
   * legge i vocali", which is true, instead of relaying a confident
   * description of a photo nobody read.
   */
  async describeMedia(): Promise<never> {
    throw new AIProviderError(
      'Questo modello non legge file: per vocali e foto serve un provider che li supporti, come Gemini.',
      this.name,
    )
  }

  async generateText(request: {
    messages: AIMessage[]
    maxOutputTokens?: number
    temperature?: number
  }): Promise<{ text: string }> {
    const response = await this.post({
      model: this.model,
      messages: toOpenAIMessages(request.messages),
      max_tokens: request.maxOutputTokens ?? 1024,
      temperature: request.temperature,
    })

    return { text: response.choices?.[0]?.message?.content ?? '' }
  }

  async generateStructuredOutput<T>(request: {
    messages: AIMessage[]
    schema: ZodType<T>
    schemaName?: string
  }): Promise<T> {
    const jsonSchema = z.toJSONSchema(request.schema, { io: 'output' }) as Record<string, unknown>
    delete jsonSchema.$schema

    const response = await this.post({
      model: this.model,
      messages: toOpenAIMessages(request.messages),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: request.schemaName ?? 'risposta',
          schema: jsonSchema,
          strict: true,
        },
      },
    })

    const text = response.choices?.[0]?.message?.content ?? ''

    try {
      return request.schema.parse(JSON.parse(text))
    } catch (cause) {
      throw new AIProviderError('Risposta strutturata non valida.', this.name, cause)
    }
  }

  private async post(body: unknown): Promise<OpenAIResponse> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      })
    } catch (cause) {
      throw new AIProviderError('Impossibile raggiungere il modello.', this.name, cause)
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new AIProviderError(
        `Il modello ha risposto ${response.status}. ${detail.slice(0, 300)}`,
        this.name,
      )
    }

    return (await response.json()) as OpenAIResponse
  }
}

type OpenAIResponse = {
  choices?: {
    message?: {
      content?: string | null
      tool_calls?: { id: string; function: { name: string; arguments: string } }[]
    }
  }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

function toOpenAIMessages(messages: AIMessage[]) {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content }
    }

    if (message.role === 'assistant') {
      return {
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: message.toolCalls?.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      }
    }

    return { role: message.role, content: message.content }
  })
}

/** Arguments arrive as a JSON string, and a model can produce a broken one. */
function safeParseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}
