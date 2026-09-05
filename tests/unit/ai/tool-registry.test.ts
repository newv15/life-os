import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { TOOLS, getTool, toolDefinitions } from '@/lib/ai/tools/registry'

/**
 * Invariants every tool has to satisfy.
 *
 * These are not tests of any single tool's behaviour - they are the rules that
 * make the tool layer safe to hand to a model at all, checked across the whole
 * registry so a tool added later cannot quietly break one.
 */

const toolList = Object.values(TOOLS)

describe('the registry as a whole', () => {
  it('is not empty', () => {
    expect(toolList.length).toBeGreaterThan(0)
  })

  it.each(toolList.map((tool) => [tool.name, tool] as const))(
    '%s is named in snake_case, the way tool APIs expect',
    (_name, tool) => {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/)
    },
  )

  it('registers each tool under its own name', () => {
    for (const [key, tool] of Object.entries(TOOLS)) {
      expect(tool.name).toBe(key)
    }
  })

  it.each(toolList.map((tool) => [tool.name, tool] as const))(
    '%s explains itself well enough for a model to choose it',
    (_name, tool) => {
      // A one-word description is how a model ends up picking the wrong tool.
      expect(tool.description.length).toBeGreaterThan(30)
    },
  )
})

describe('what the model is allowed to say', () => {
  it.each(toolList.map((tool) => [tool.name, tool] as const))(
    '%s never accepts an owner from the caller',
    (_name, tool) => {
      // The single most important rule in the whole AI layer: the owner is
      // injected by the server from the session or the Telegram link. If a
      // tool accepted one, a model could be talked into writing to another
      // person's data.
      const properties = Object.keys(tool.parameters.shape)

      expect(properties).not.toContain('userId')
      expect(properties).not.toContain('user_id')
    },
  )

  it.each(toolList.map((tool) => [tool.name, tool] as const))(
    '%s has parameters a model can actually be given',
    (_name, tool) => {
      // Anything unconvertible - a Date, a transform, a pipe - would either
      // throw here or reach the model as an empty object it has to guess at.
      expect(() => z.toJSONSchema(tool.parameters, { io: 'input' })).not.toThrow()
    },
  )

  it('describes every field it asks for', () => {
    const undescribed: string[] = []

    for (const tool of toolList) {
      const schema = z.toJSONSchema(tool.parameters, { io: 'input' }) as {
        properties?: Record<string, { description?: string }>
      }

      for (const [field, definition] of Object.entries(schema.properties ?? {})) {
        if (!definition.description) undescribed.push(`${tool.name}.${field}`)
      }
    }

    // A field with no description is a field the model fills in by guessing.
    expect(undescribed).toEqual([])
  })
})

describe('toolDefinitions', () => {
  it('produces one definition per registered tool', () => {
    expect(toolDefinitions()).toHaveLength(toolList.length)
  })

  it('gives each definition a name, a description and a parameter schema', () => {
    for (const definition of toolDefinitions()) {
      expect(definition.name).toBeTruthy()
      expect(definition.description).toBeTruthy()
      expect(definition.parameters.type).toBe('object')
    }
  })

  it('strips the $schema key, which some providers reject', () => {
    for (const definition of toolDefinitions()) {
      expect(definition.parameters).not.toHaveProperty('$schema')
    }
  })
})

describe('getTool', () => {
  it('finds a registered tool', () => {
    expect(getTool('create_task')?.name).toBe('create_task')
  })

  it('returns nothing for a name the model invented', () => {
    expect(getTool('fai_tutto_tu')).toBeUndefined()
  })
})

describe('confirmation', () => {
  it('asks before anything that destroys data', () => {
    // Deleting is the one class of action a model must never do on its own
    // say-so. Every destructive tool has to supply the question to ask.
    const destructive = toolList.filter((tool) => tool.name.startsWith('delete_'))

    expect(destructive.length).toBeGreaterThan(0)
    for (const tool of destructive) {
      expect(tool.confirm, `${tool.name} deve chiedere conferma`).toBeDefined()
    }
  })

  it('phrases the question with the specifics, not in general terms', () => {
    const deleteTask = getTool('delete_task')!
    const question = deleteTask.confirm!({ id: '11111111-1111-4111-8111-111111111111' })

    expect(question).toBeTruthy()
    expect(question!.length).toBeGreaterThan(10)
  })
})
