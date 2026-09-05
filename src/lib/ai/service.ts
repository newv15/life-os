import { AIProviderError, type AIMessage, type AIProvider } from '@/lib/ai/provider'
import { buildContext } from '@/lib/ai/context'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import { getTool, toolDefinitions } from '@/lib/ai/tools/registry'
import type { Tool, ToolContext } from '@/lib/ai/tools/types'
import { AppError, ValidationError } from '@/lib/services/errors'
import { captureInboxItem } from '@/lib/services/inbox'
import { DEFAULT_TIMEZONE } from '@/lib/utils/date'
import type { Db, Enums } from '@/lib/db/types'

/**
 * The loop around the model.
 *
 * The model proposes; this decides. Each round it may ask for tools; each tool
 * is looked up, validated, authorised and run against a service, and the result
 * is handed back so the next round can report what happened. Nothing here lets
 * a model reach the database except through that path.
 */

/** A model that keeps calling tools without answering has to be stopped. */
const MAX_ROUNDS = 5

export type AIRunResult = {
  reply: string
  executedTools: string[]
  conversationId: string
  /** Set when a destructive action is waiting for a yes. */
  pendingConfirmation?: { id: string; question: string }
}

export type HandleMessageOptions = {
  db: Db
  userId: string
  provider: AIProvider
  channel: Enums['ai_channel']
  message: string
  timezone?: string
  /** Continues an existing conversation; a new one is started when absent. */
  conversationId?: string
  telegramChatId?: number
}

export async function handleUserMessage(options: HandleMessageOptions): Promise<AIRunResult> {
  const { db, userId, provider, channel, message } = options
  const timezone = options.timezone ?? DEFAULT_TIMEZONE
  const now = new Date()

  const conversationId = await ensureConversation(options)
  await saveMessage(db, userId, conversationId, { role: 'user', content: message })

  const context = await buildContext(db, userId, now, timezone)
  const toolContext: ToolContext = { db, userId, channel, timezone, now }

  const messages: AIMessage[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...(await recentHistory(db, userId, conversationId)),
    { role: 'user', content: message },
  ]

  const executedTools: string[] = []
  /** What each tool actually did, in case the model dies before reporting it. */
  const executedSummaries: string[] = []
  const tools = toolDefinitions()

  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const answer = await provider.executeToolCalling({ messages, tools })

      if (answer.toolCalls.length === 0) {
        const reply = answer.text?.trim() || 'Fatto.'
        await saveMessage(db, userId, conversationId, { role: 'assistant', content: reply })
        return { reply, executedTools, conversationId }
      }

      messages.push({
        role: 'assistant',
        content: answer.text,
        toolCalls: answer.toolCalls,
      })

      for (const toolCall of answer.toolCalls) {
        const tool = getTool(toolCall.name)

        if (!tool) {
          messages.push(toolResult(toolCall.id, toolCall.name, {
            errore: `Lo strumento "${toolCall.name}" non esiste. Usa solo quelli elencati.`,
          }))
          continue
        }

        const parsed = tool.parameters.safeParse(toolCall.arguments)
        if (!parsed.success) {
          const detail = parsed.error.issues
            .map((issue) => `${issue.path.join('.') || 'argomenti'}: ${issue.message}`)
            .join('; ')

          await logAction(db, userId, conversationId, tool.name, toolCall.arguments, {
            success: false,
            error: detail,
            durationMs: 0,
          })

          messages.push(toolResult(toolCall.id, tool.name, { errore: detail }))
          continue
        }

        // A destructive action stops the whole turn. The arguments are parked
        // in the database because the answer arrives in a later request - on
        // Telegram, possibly minutes later, with no memory of this one.
        const question = tool.confirm?.(parsed.data) ?? null
        if (question) {
          const pending = await createConfirmation(
            db,
            userId,
            conversationId,
            tool.name,
            parsed.data,
            question,
          )

          await saveMessage(db, userId, conversationId, { role: 'assistant', content: question })
          return {
            reply: question,
            executedTools,
            conversationId,
            pendingConfirmation: { id: pending, question },
          }
        }

        const outcome = await runTool(db, userId, conversationId, tool, toolContext, parsed.data)
        if (outcome.ok) {
          executedTools.push(tool.name)
          const summary = (outcome.payload as { risultato?: string }).risultato
          if (summary) executedSummaries.push(summary)
        }

        messages.push(toolResult(toolCall.id, tool.name, outcome.payload))
      }
    }

    // Out of rounds. Say so rather than returning silence.
    const reply =
      'Ho fatto qualche tentativo ma non sono arrivato a una risposta. Prova a dirmelo in modo più diretto.'
    await saveMessage(db, userId, conversationId, { role: 'assistant', content: reply })
    return { reply, executedTools, conversationId }
  } catch (error) {
    if (error instanceof AIProviderError) {
      // Logged, because the user-facing message is deliberately vague and
      // without this the only symptom is "the AI is down" with no way to tell
      // a rate limit from a malformed request.
      console.error(`[ai] provider ${error.provider} non disponibile: ${error.message}`)

      // Whether work already happened changes the right answer completely.
      //
      // If a tool ran and we then said "couldn't reach the model, saved to
      // inbox", the person would enter the expense again and have it twice.
      // So when something was done, report it and park nothing.
      if (executedSummaries.length > 0) {
        const reply = `${executedSummaries.join(' ')}\n\n(Il modello si è interrotto dopo, ma quello che ho scritto è registrato.)`
        await saveMessage(db, userId, conversationId, { role: 'assistant', content: reply })
        return { reply, executedTools, conversationId }
      }

      // Nothing was written, so the rule that makes an outage survivable
      // applies: never lose what was typed.
      await captureInboxItem(db, userId, { rawText: message }, channel === 'telegram' ? 'telegram' : 'ai')

      const reply =
        'Al momento non riesco a raggiungere il modello. Ho salvato il tuo messaggio in inbox, così non va perso.'
      await saveMessage(db, userId, conversationId, { role: 'assistant', content: reply })
      return { reply, executedTools, conversationId }
    }
    throw error
  }
}

export type ResolveConfirmationOptions = {
  db: Db
  userId: string
  confirmationId: string
  confirmed: boolean
  channel: Enums['ai_channel']
  timezone?: string
}

/** Runs, or abandons, an action that was waiting for a yes. */
export async function resolveConfirmation(
  options: ResolveConfirmationOptions,
): Promise<AIRunResult> {
  const { db, userId, confirmationId, confirmed, channel } = options
  const timezone = options.timezone ?? DEFAULT_TIMEZONE

  const { data: pending } = await db
    .from('pending_confirmations')
    .select('*')
    .eq('user_id', userId)
    .eq('id', confirmationId)
    .is('resolved_at', null)
    .maybeSingle()

  if (!pending) {
    return {
      reply: 'Questa richiesta non è più in attesa: potrebbe essere scaduta o già risolta.',
      executedTools: [],
      conversationId: '',
    }
  }

  const conversationId = pending.conversation_id ?? ''

  if (new Date(pending.expires_at) < new Date()) {
    await db
      .from('pending_confirmations')
      .update({ resolved_at: new Date().toISOString(), resolution: 'expired' })
      .eq('id', confirmationId)

    return {
      reply: 'Era passato troppo tempo, quindi non ho fatto nulla. Ripetimelo se serve ancora.',
      executedTools: [],
      conversationId,
    }
  }

  if (!confirmed) {
    await db
      .from('pending_confirmations')
      .update({ resolved_at: new Date().toISOString(), resolution: 'rejected' })
      .eq('id', confirmationId)

    return { reply: 'Non ho fatto nulla.', executedTools: [], conversationId }
  }

  const tool = getTool(pending.tool_name)
  if (!tool) {
    return { reply: 'Questa azione non è più disponibile.', executedTools: [], conversationId }
  }

  const toolContext: ToolContext = { db, userId, channel, timezone, now: new Date() }
  const outcome = await runTool(
    db,
    userId,
    conversationId || null,
    tool,
    toolContext,
    // Stored as jsonb; it was validated by the tool's schema before being
    // parked, and the tool validates it again on the way through.
    pending.arguments as Record<string, unknown>,
  )

  await db
    .from('pending_confirmations')
    .update({ resolved_at: new Date().toISOString(), resolution: 'confirmed' })
    .eq('id', confirmationId)

  const reply = outcome.ok
    ? String((outcome.payload as { risultato?: string }).risultato ?? 'Fatto.')
    : `Non ci sono riuscito: ${String((outcome.payload as { errore?: string }).errore ?? '')}`

  if (conversationId) {
    await saveMessage(db, userId, conversationId, { role: 'assistant', content: reply })
  }

  return {
    reply,
    executedTools: outcome.ok ? [tool.name] : [],
    conversationId,
  }
}

// --- internals ---------------------------------------------------------------

type ToolRunOutcome = { ok: boolean; payload: Record<string, unknown> }

async function runTool(
  db: Db,
  userId: string,
  conversationId: string | null,
  tool: Tool,
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<ToolRunOutcome> {
  const startedAt = Date.now()

  try {
    const outcome = await tool.execute(ctx, args)
    const durationMs = Date.now() - startedAt

    await logAction(db, userId, conversationId, tool.name, args, {
      success: true,
      result: outcome,
      durationMs,
    })

    return { ok: true, payload: { risultato: outcome.summary, dati: outcome.data } }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    // A tool failing is normal - a name that does not resolve, a date that does
    // not parse. The message goes back to the model so it can ask, rather than
    // becoming a stack trace the person has to interpret.
    //
    // A ValidationError carries its detail per field, and that detail is the
    // whole point here: "Dati non validi" tells the model nothing, while
    // "dueAt: data non riconosciuta" tells it exactly what to ask about.
    const message = describeFailure(error)

    if (!(error instanceof AppError)) {
      console.error(`[ai] ${tool.name} è fallito`, error)
    }

    await logAction(db, userId, conversationId, tool.name, args, {
      success: false,
      error: message,
      durationMs,
    })

    return { ok: false, payload: { errore: message } }
  }
}

/** The most useful sentence available about why a tool failed. */
function describeFailure(error: unknown): string {
  if (error instanceof ValidationError) {
    const detail = Object.entries(error.issues)
      .map(([field, issue]) => `${field}: ${issue}`)
      .join('; ')

    return detail === '' ? error.message : `${error.message} ${detail}`
  }

  if (error instanceof AppError) return error.message
  return "Errore imprevisto durante l'operazione."
}

function toolResult(id: string, name: string, payload: Record<string, unknown>): AIMessage {
  return { role: 'tool', toolCallId: id, name, content: JSON.stringify(payload) }
}

async function ensureConversation(options: HandleMessageOptions): Promise<string> {
  const { db, userId, channel, conversationId, telegramChatId } = options

  if (conversationId) return conversationId

  // Telegram keeps one rolling conversation per chat, so context survives
  // between messages without growing without bound.
  if (channel === 'telegram' && telegramChatId !== undefined) {
    const { data: existing } = await db
      .from('ai_conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('telegram_chat_id', telegramChatId)
      .maybeSingle()

    if (existing) {
      await db
        .from('ai_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', existing.id)
      return existing.id
    }
  }

  const { data, error } = await db
    .from('ai_conversations')
    .insert({
      user_id: userId,
      channel,
      telegram_chat_id: telegramChatId ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

/** The last few turns, oldest first. Enough for "e anche domani", not a diary. */
async function recentHistory(
  db: Db,
  userId: string,
  conversationId: string,
): Promise<AIMessage[]> {
  const { data } = await db
    .from('ai_messages')
    .select('role, content')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(8)

  return (data ?? [])
    .reverse()
    .filter((row) => row.content)
    .map((row) =>
      row.role === 'user'
        ? ({ role: 'user', content: row.content! } as const)
        : ({ role: 'assistant', content: row.content! } as const),
    )
}

async function saveMessage(
  db: Db,
  userId: string,
  conversationId: string,
  message: { role: 'user' | 'assistant'; content: string },
): Promise<void> {
  await db.from('ai_messages').insert({
    user_id: userId,
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
  })

  await db
    .from('ai_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)
}

async function logAction(
  db: Db,
  userId: string,
  conversationId: string | null,
  toolName: string,
  args: unknown,
  outcome: { success: boolean; result?: unknown; error?: string; durationMs: number },
): Promise<void> {
  await db.from('ai_action_logs').insert({
    user_id: userId,
    conversation_id: conversationId,
    tool_name: toolName,
    arguments: args as never,
    result: (outcome.result ?? null) as never,
    success: outcome.success,
    error: outcome.error ?? null,
    duration_ms: outcome.durationMs,
  })
}

async function createConfirmation(
  db: Db,
  userId: string,
  conversationId: string,
  toolName: string,
  args: unknown,
  question: string,
): Promise<string> {
  const { data, error } = await db
    .from('pending_confirmations')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      tool_name: toolName,
      arguments: args as never,
      summary: question,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}
