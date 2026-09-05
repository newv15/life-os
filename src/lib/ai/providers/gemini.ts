import { z, type ZodType } from 'zod'
import {
  AIProviderError,
  type AIMessage,
  type AIProvider,
  type AIToolDefinition,
  type AIToolResult,
} from '@/lib/ai/provider'
import {
  fromGeminiResponse,
  toGeminiContents,
  toGeminiSchema,
  toGeminiTools,
  type GeminiResponse,
} from '@/lib/ai/providers/gemini-mapping'

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * Google Gemini.
 *
 * The default because its free tier is the only one that offers both tool
 * calling and structured output without a card. All the shape-juggling lives
 * in gemini-mapping and is tested there; this file is the HTTP call and the
 * failure handling around it.
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  async executeToolCalling(request: {
    messages: AIMessage[]
    tools: AIToolDefinition[]
    maxOutputTokens?: number
  }): Promise<AIToolResult> {
    const { systemInstruction, contents } = toGeminiContents(request.messages)

    const body = {
      systemInstruction,
      contents,
      tools: toGeminiTools(request.tools),
      generationConfig: { maxOutputTokens: request.maxOutputTokens ?? 2048 },
    }

    return fromGeminiResponse(await this.post('generateContent', body))
  }

  async generateText(request: {
    messages: AIMessage[]
    maxOutputTokens?: number
    temperature?: number
  }): Promise<{ text: string }> {
    const { systemInstruction, contents } = toGeminiContents(request.messages)

    const response = await this.post('generateContent', {
      systemInstruction,
      contents,
      generationConfig: {
        maxOutputTokens: request.maxOutputTokens ?? 1024,
        temperature: request.temperature,
      },
    })

    return { text: fromGeminiResponse(response).text ?? '' }
  }

  async generateStructuredOutput<T>(request: {
    messages: AIMessage[]
    schema: ZodType<T>
  }): Promise<T> {
    const { systemInstruction, contents } = toGeminiContents(request.messages)
    const jsonSchema = z.toJSONSchema(request.schema, { io: 'output' }) as Record<string, unknown>
    delete jsonSchema.$schema

    const response = await this.post('generateContent', {
      systemInstruction,
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(jsonSchema),
      },
    })

    const text = fromGeminiResponse(response).text ?? ''

    try {
      // Parsed with our own schema rather than trusted: "structured output"
      // is a strong hint from the provider, not a guarantee.
      return request.schema.parse(JSON.parse(text))
    } catch (cause) {
      throw new AIProviderError('Risposta strutturata non valida.', this.name, cause)
    }
  }

  private async post(action: string, body: unknown): Promise<GeminiResponse> {
    const url = `${this.baseUrl}/models/${this.model}:${action}`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // In the header rather than the query string, so the key cannot end
          // up in a proxy log or an error report.
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      })
    } catch (cause) {
      // The cause is kept in the message, not just attached: without it the
      // only symptom is "cannot reach the model", which covers a DNS failure,
      // a timeout and a TLS error alike.
      const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)
      throw new AIProviderError(`Impossibile raggiungere il modello (${detail}).`, this.name, cause)
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new AIProviderError(
        `Il modello ha risposto ${response.status}. ${detail.slice(0, 300)}`,
        this.name,
      )
    }

    return (await response.json()) as GeminiResponse
  }
}
