import type { z } from 'zod'
import type { Db, Enums } from '@/lib/db/types'

/**
 * What a tool is allowed to know.
 *
 * `userId` arrives here from the session or the Telegram link, never from the
 * model, and every tool passes it straight to a service. That is the whole
 * security story of the AI layer in one field.
 */
export type ToolContext = {
  db: Db
  userId: string
  channel: Enums['ai_channel']
  timezone: string
  /** Fixed for the whole turn, so two tools in one request agree on "now". */
  now: Date
}

export type ToolOutcome = {
  /**
   * One line, in Italian, saying exactly what happened.
   *
   * This is what gets echoed back, and it is the main defence against a model
   * quietly doing the wrong thing: the person reads what was actually written,
   * not what they hoped had been.
   */
  summary: string
  /** Small structured payload the model can reason about in the next turn. */
  data?: unknown
}

// The registry holds tools with differing parameter shapes, so their inputs
// cannot be related to one another at the type level. Each tool's own
// signature stays typed through `defineTool`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolParameters = z.ZodObject<any>

export type Tool<TParams extends AnyToolParameters = AnyToolParameters> = {
  name: string
  /** Written for the model: when to reach for this, and when not to. */
  description: string
  parameters: TParams
  /**
   * Returns the question to ask before running, or null to run straight away.
   *
   * Returning the wording rather than a boolean means the question can name
   * what is about to happen - "elimino il progetto X e i suoi 18 task?" -
   * instead of asking a generic "sei sicuro?" that nobody reads.
   */
  confirm?: (args: z.infer<TParams>) => string | null
  execute: (ctx: ToolContext, args: z.infer<TParams>) => Promise<ToolOutcome>
}

/** Keeps each tool's argument type tied to its own schema. */
export function defineTool<TParams extends AnyToolParameters>(tool: Tool<TParams>): Tool<TParams> {
  return tool
}
