import { translateDbError } from '@/lib/services/errors'
import type { Db, Tables } from '@/lib/db/types'

/**
 * Getting your data out.
 *
 * Two formats, because they answer two different questions. JSON is the
 * backup: every table, exact values, restorable. CSV is for looking at
 * something in a spreadsheet, which is a different job with different rules -
 * hence the semicolons and the decimal commas below.
 */

/**
 * Everything the JSON backup contains, in an order that could be replayed:
 * parents before the rows that point at them.
 *
 * Written out rather than discovered from the schema on purpose. A new table
 * should be a deliberate decision to include, not something that starts
 * appearing in the user's backup because it exists. Left out: the Telegram
 * link (chat plumbing, not life data), pending confirmations and processed
 * update ids, all of which are meaningless outside a running system.
 */
export const EXPORT_TABLES = [
  'profiles',
  'categories',
  'tags',
  'people',
  'goals',
  'goal_milestones',
  'projects',
  'tasks',
  'events',
  'accounts',
  'transactions',
  'budgets',
  'habits',
  'habit_entries',
  'journal_entries',
  'notes',
  'inbox_items',
  'time_entries',
  'taggables',
  'entity_links',
  'memories',
  'automation_rules',
  'notifications',
  'ai_conversations',
  'ai_messages',
  'ai_action_logs',
] as const satisfies readonly (keyof Tables)[]

export type ExportTable = (typeof EXPORT_TABLES)[number]

/** The tables worth opening in a spreadsheet, and what to call the file. */
export const CSV_TABLES: { table: ExportTable; label: string }[] = [
  { table: 'transactions', label: 'Movimenti' },
  { table: 'tasks', label: 'Task' },
  { table: 'events', label: 'Appuntamenti' },
  { table: 'time_entries', label: 'Tempo' },
  { table: 'habit_entries', label: 'Abitudini' },
]

export type ExportRow = Record<string, unknown>

export async function selectTable(
  db: Db,
  userId: string,
  table: ExportTable,
): Promise<ExportRow[]> {
  const { data, error } = await db.from(table).select('*').eq('user_id', userId)

  if (error) throw translateDbError(error, `Esportazione di ${table} non riuscita`)
  return (data ?? []) as ExportRow[]
}

/** The whole account as one object, for a backup rather than for reading. */
export async function exportEverything(
  db: Db,
  userId: string,
): Promise<{ exportedAt: string; tables: Record<string, ExportRow[]> }> {
  const tables: Record<string, ExportRow[]> = {}

  // Sequential on purpose: this runs on a free serverless plan, and twenty-six
  // parallel queries is how a single click exhausts the connection pool.
  for (const table of EXPORT_TABLES) {
    tables[table] = await selectTable(db, userId, table)
  }

  return { exportedAt: new Date().toISOString(), tables }
}

// --- CSV ---------------------------------------------------------------------

/**
 * Semicolons, not commas.
 *
 * An Italian spreadsheet reads `35.50` as a date and splits `1.234,50` down the
 * middle. Writing amounts the way the machine expects them - decimal comma -
 * forces the separator to be something else, and the byte order mark is what
 * makes Excel read the accents instead of mangling them.
 */
const SEPARATOR = ';'
const BOM = '﻿'

/**
 * A value that is a decimal number and nothing else.
 *
 * Money columns are `numeric(12,2)`, and the driver hands those over as
 * strings so the last cent survives the trip through JavaScript. Without this
 * the whole amounts column would reach the spreadsheet as dates.
 */
const DECIMAL = /^-?\d+\.\d+$/

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''

  const raw =
    typeof value === 'object' ? JSON.stringify(value) : String(value)

  const text =
    typeof value === 'number' || (typeof value === 'string' && DECIMAL.test(value))
      ? raw.replace('.', ',')
      : raw

  const needsQuotes =
    text.includes(SEPARATOR) || text.includes('"') || text.includes('\n') || text.includes('\r')

  return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCSV(rows: ExportRow[]): string {
  // A header with no rows under it looks like data that failed to arrive.
  if (rows.length === 0) return ''

  const columns = Object.keys(rows[0])
  const lines = [
    columns.join(SEPARATOR),
    ...rows.map((row) => columns.map((column) => cell(row[column])).join(SEPARATOR)),
  ]

  return BOM + lines.join('\r\n')
}
