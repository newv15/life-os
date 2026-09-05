import { z } from 'zod'
import type { AIToolDefinition } from '@/lib/ai/provider'
import type { Tool } from '@/lib/ai/tools/types'
import {
  completeTaskTool,
  createTaskTool,
  deleteTaskTool,
  listTasksTool,
} from '@/lib/ai/tools/tasks'
import {
  createTransactionTool,
  getFinancialSummaryTool,
  listTransactionsTool,
} from '@/lib/ai/tools/finance'
import {
  captureNoteTool,
  createGoalTool,
  createProjectTool,
  getTodayTool,
  listGoalsTool,
  listInboxTool,
  listProjectsTool,
  updateGoalProgressTool,
} from '@/lib/ai/tools/planning'
import {
  completeHabitTool,
  createEventTool,
  createHabitTool,
  createPersonTool,
  getAgendaTool,
  getTimeSummaryTool,
  listHabitsTool,
  listPeopleTool,
  setPersonNextActionTool,
  startTimerTool,
  stopTimerTool,
  writeJournalTool,
} from '@/lib/ai/tools/life'

/**
 * Everything the model is allowed to do.
 *
 * This list is the entire surface between a language model and a database. It
 * holds no SQL, takes no owner from the caller, and every entry ends in a
 * service that validates what it was given. Adding a tool here is the only way
 * to widen what the AI can do - which is the point.
 */
const ALL_TOOLS: Tool[] = [
  // Tasks
  createTaskTool,
  completeTaskTool,
  listTasksTool,
  deleteTaskTool,
  // Money
  createTransactionTool,
  getFinancialSummaryTool,
  listTransactionsTool,
  // Structure
  createProjectTool,
  listProjectsTool,
  createGoalTool,
  updateGoalProgressTool,
  listGoalsTool,
  // Calendar
  createEventTool,
  getAgendaTool,
  // Habits
  createHabitTool,
  completeHabitTool,
  listHabitsTool,
  // Journal
  writeJournalTool,
  // People
  createPersonTool,
  setPersonNextActionTool,
  listPeopleTool,
  // Time
  startTimerTool,
  stopTimerTool,
  getTimeSummaryTool,
  // Capture and overview
  captureNoteTool,
  listInboxTool,
  getTodayTool,
]

export const TOOLS: Record<string, Tool> = Object.fromEntries(
  ALL_TOOLS.map((tool) => [tool.name, tool]),
)

export function getTool(name: string): Tool | undefined {
  return TOOLS[name]
}

/**
 * The tool list as a provider wants it.
 *
 * `$schema` is stripped because several providers reject a JSON Schema that
 * declares its own dialect, and none of them need it.
 */
export function toolDefinitions(): AIToolDefinition[] {
  return ALL_TOOLS.map((tool) => {
    const parameters = z.toJSONSchema(tool.parameters, { io: 'input' }) as Record<string, unknown>
    delete parameters.$schema

    return {
      name: tool.name,
      description: tool.description,
      parameters,
    }
  })
}
