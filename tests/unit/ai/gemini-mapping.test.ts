import { describe, expect, it } from 'vitest'
import {
  fromGeminiResponse,
  toGeminiContents,
  toGeminiSchema,
  toGeminiTools,
} from '@/lib/ai/providers/gemini-mapping'
import { toolDefinitions } from '@/lib/ai/tools/registry'

/**
 * The translation layer between our shapes and Gemini's.
 *
 * This is where an adapter quietly goes wrong: a schema the provider rejects,
 * a tool result sent under the wrong role, a reply parsed as empty. None of it
 * needs a network call to test, and all of it is the kind of mistake that
 * looks like "the AI is being stupid" from the outside.
 */

describe('toGeminiSchema', () => {
  it('turns a nullable type array into the nullable flag Gemini expects', () => {
    // Our optional fields produce {"type": ["string", "null"]}, which Gemini
    // rejects outright. This is the single most likely reason a tool would
    // never be offered to the model at all.
    const schema = toGeminiSchema({ type: ['string', 'null'] })

    expect(schema).toEqual({ type: 'string', nullable: true })
  })

  it('leaves an ordinary type alone', () => {
    expect(toGeminiSchema({ type: 'string' })).toEqual({ type: 'string' })
  })

  it('keeps descriptions, which are how the model knows what to send', () => {
    const schema = toGeminiSchema({ type: 'string', description: 'Il titolo' })
    expect(schema.description).toBe('Il titolo')
  })

  it('keeps enums', () => {
    const schema = toGeminiSchema({ type: 'string', enum: ['low', 'high'] })
    expect(schema.enum).toEqual(['low', 'high'])
  })

  it('drops keywords Gemini does not accept', () => {
    const schema = toGeminiSchema({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
      default: 'medium',
      properties: {},
    })

    expect(schema).not.toHaveProperty('$schema')
    expect(schema).not.toHaveProperty('additionalProperties')
    expect(schema).not.toHaveProperty('default')
  })

  it('walks into nested properties', () => {
    const schema = toGeminiSchema({
      type: 'object',
      properties: {
        title: { type: 'string' },
        dueAt: { type: ['string', 'null'], description: 'Quando' },
      },
      required: ['title'],
    })

    expect(schema.properties).toEqual({
      title: { type: 'string' },
      dueAt: { type: 'string', nullable: true, description: 'Quando' },
    })
    expect(schema.required).toEqual(['title'])
  })

  it('walks into arrays', () => {
    const schema = toGeminiSchema({
      type: 'array',
      items: { type: ['number', 'null'] },
    })

    expect(schema.items).toEqual({ type: 'number', nullable: true })
  })
})

describe('toGeminiTools', () => {
  it('wraps the declarations the way the API expects', () => {
    const tools = toGeminiTools([
      { name: 'create_task', description: 'Crea', parameters: { type: 'object', properties: {} } },
    ])

    expect(tools).toHaveLength(1)
    expect(tools[0].functionDeclarations[0].name).toBe('create_task')
  })

  it('sanitises the parameter schema on the way', () => {
    const tools = toGeminiTools([
      {
        name: 'x',
        description: 'y',
        parameters: {
          type: 'object',
          properties: { a: { type: ['string', 'null'] } },
        },
      },
    ])

    expect(tools[0].functionDeclarations[0].parameters.properties).toEqual({
      a: { type: 'string', nullable: true },
    })
  })
})

describe('toGeminiContents', () => {
  it('lifts the system message out, where Gemini keeps it', () => {
    const { systemInstruction, contents } = toGeminiContents([
      { role: 'system', content: 'Sei un assistente' },
      { role: 'user', content: 'ciao' },
    ])

    expect(systemInstruction?.parts[0].text).toBe('Sei un assistente')
    expect(contents).toHaveLength(1)
  })

  it('renames the assistant role to model', () => {
    const { contents } = toGeminiContents([{ role: 'assistant', content: 'ecco' }])
    expect(contents[0].role).toBe('model')
  })

  it('sends tool calls as function calls', () => {
    const { contents } = toGeminiContents([
      {
        role: 'assistant',
        toolCalls: [{ id: '1', name: 'create_task', arguments: { title: 'X' } }],
      },
    ])

    expect(contents[0].parts[0]).toEqual({
      functionCall: { name: 'create_task', args: { title: 'X' } },
    })
  })

  it('sends a tool result as a function response, parsed rather than as a string', () => {
    const { contents } = toGeminiContents([
      { role: 'tool', toolCallId: '1', name: 'create_task', content: '{"risultato":"fatto"}' },
    ])

    expect(contents[0].parts[0]).toEqual({
      functionResponse: { name: 'create_task', response: { risultato: 'fatto' } },
    })
  })

  it('survives a tool result that is not valid json', () => {
    const { contents } = toGeminiContents([
      { role: 'tool', toolCallId: '1', name: 'x', content: 'non json' },
    ])

    expect(contents[0].parts[0]).toEqual({
      functionResponse: { name: 'x', response: { risultato: 'non json' } },
    })
  })

  it('drops an assistant turn with nothing in it', () => {
    // Gemini rejects a content with no parts, and an empty assistant turn is
    // exactly what a tool-only round produces if we are careless.
    const { contents } = toGeminiContents([
      { role: 'user', content: 'ciao' },
      { role: 'assistant', content: '' },
    ])

    expect(contents).toHaveLength(1)
  })
})

describe('fromGeminiResponse', () => {
  it('reads plain text', () => {
    const result = fromGeminiResponse({
      candidates: [{ content: { parts: [{ text: 'Ciao' }] } }],
    })

    expect(result.text).toBe('Ciao')
    expect(result.toolCalls).toEqual([])
  })

  it('reads a function call', () => {
    const result = fromGeminiResponse({
      candidates: [
        {
          content: {
            parts: [{ functionCall: { name: 'create_task', args: { title: 'X' } } }],
          },
        },
      ],
    })

    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].name).toBe('create_task')
    expect(result.toolCalls[0].arguments).toEqual({ title: 'X' })
    // Gemini gives calls no id, so one is invented - the loop pairs results
    // to calls by it.
    expect(result.toolCalls[0].id).toBeTruthy()
  })

  it('reads text and a call arriving together', () => {
    const result = fromGeminiResponse({
      candidates: [
        {
          content: {
            parts: [{ text: 'Registro subito' }, { functionCall: { name: 'x', args: {} } }],
          },
        },
      ],
    })

    expect(result.text).toBe('Registro subito')
    expect(result.toolCalls).toHaveLength(1)
  })

  it('reports token usage when the API includes it', () => {
    const result = fromGeminiResponse({
      candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 8 },
    })

    expect(result.usage).toEqual({ inputTokens: 120, outputTokens: 8 })
  })

  it('copes with an empty candidate list rather than throwing', () => {
    const result = fromGeminiResponse({ candidates: [] })

    expect(result.toolCalls).toEqual([])
    expect(result.text).toBeUndefined()
  })
})

describe('the real tool registry through the Gemini sanitiser', () => {
  it('leaves no type array anywhere, which Gemini would reject', () => {
    // The end-to-end version of the nullable case: every optional field in
    // every tool has to survive the trip, or that tool silently never reaches
    // the model.
    const offenders: string[] = []

    const walk = (node: unknown, path: string) => {
      if (!node || typeof node !== 'object') return
      const record = node as Record<string, unknown>
      if (Array.isArray(record.type)) offenders.push(path)
      for (const [key, value] of Object.entries(record)) walk(value, `${path}.${key}`)
    }

    for (const definition of toolDefinitions()) {
      walk(toGeminiSchema(definition.parameters), definition.name)
    }

    expect(offenders).toEqual([])
  })

  it('keeps every tool declarable', () => {
    expect(toGeminiTools(toolDefinitions())[0].functionDeclarations).toHaveLength(
      toolDefinitions().length,
    )
  })
})

describe('thought signatures', () => {
  /**
   * Gemini 3 refuses a conversation that replays a function call without the
   * opaque signature it issued with it: "Function call is missing a
   * thought_signature in functionCall parts". The first round works, the
   * second is rejected with a 400 - so a tool runs and the model then appears
   * to go down, which is the worst possible way for this to fail.
   */

  it('keeps the signature that came with a function call', () => {
    const result = fromGeminiResponse({
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: { name: 'create_task', args: {} },
                thoughtSignature: 'firma-opaca',
              },
            ],
          },
        },
      ],
    })

    expect(result.toolCalls[0].opaque).toBe('firma-opaca')
  })

  it('hands it back on the way in', () => {
    const { contents } = toGeminiContents([
      {
        role: 'assistant',
        toolCalls: [
          { id: '1', name: 'create_task', arguments: { title: 'X' }, opaque: 'firma-opaca' },
        ],
      },
    ])

    expect(contents[0].parts[0]).toEqual({
      functionCall: { name: 'create_task', args: { title: 'X' } },
      thoughtSignature: 'firma-opaca',
    })
  })

  it('omits the field entirely when there was no signature', () => {
    const { contents } = toGeminiContents([
      { role: 'assistant', toolCalls: [{ id: '1', name: 'x', arguments: {} }] },
    ])

    expect(contents[0].parts[0]).toEqual({ functionCall: { name: 'x', args: {} } })
  })

  it('survives a call that arrives without one', () => {
    const result = fromGeminiResponse({
      candidates: [{ content: { parts: [{ functionCall: { name: 'x', args: {} } }] } }],
    })

    expect(result.toolCalls[0].opaque).toBeUndefined()
  })
})
