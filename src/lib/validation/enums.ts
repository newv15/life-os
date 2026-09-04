import type { Database } from '@/types/database'

/**
 * The application's copy of the database enums.
 *
 * zod needs literals, so the values are written out here - and each list is
 * then checked against the generated database types. Add a value to a Postgres
 * enum, or mistype one here, and `npm run typecheck` fails, instead of the
 * mismatch surfacing later as a runtime error on a form nobody tested.
 *
 * The check has to be a separate assertion rather than a `satisfies` clause:
 * `satisfies` cannot refer to the type of the value being declared, so any
 * constraint written there is satisfied by a subset of the enum and catches
 * nothing.
 */

type Enums = Database['public']['Enums']

/** True only when the list and the database enum contain exactly each other. */
type SameMembers<Db extends string, Listed extends readonly string[]> = [
  Exclude<Db, Listed[number]>,
] extends [never]
  ? [Exclude<Listed[number], Db>] extends [never]
    ? true
    : false
  : false

/** Fails to compile unless given `true`. */
type Assert<T extends true> = T

export const TASK_STATUSES = ['inbox', 'todo', 'doing', 'blocked', 'done', 'cancelled'] as const
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export const PROJECT_STATUSES = ['idea', 'active', 'paused', 'done', 'archived'] as const
export const GOAL_HORIZONS = ['yearly', 'quarterly', 'monthly', 'weekly'] as const
export const GOAL_STATUSES = ['active', 'paused', 'done', 'abandoned'] as const
export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const
export const ACCOUNT_TYPES = ['cash', 'bank', 'card', 'savings', 'other'] as const
export const CATEGORY_KINDS = ['expense', 'income', 'task', 'note', 'time'] as const
export const INBOX_STATUSES = ['pending', 'triaged', 'dismissed'] as const
export const CREATED_VIA = ['web', 'telegram', 'ai', 'system'] as const

// --- Drift guards ------------------------------------------------------------
// Exported so they are not stripped as unused. Each one is a compile error the
// moment its list stops matching the database.

export type TaskStatusesMatchDb = Assert<SameMembers<Enums['task_status'], typeof TASK_STATUSES>>
export type PrioritiesMatchDb = Assert<SameMembers<Enums['priority_level'], typeof PRIORITIES>>
export type ProjectStatusesMatchDb = Assert<
  SameMembers<Enums['project_status'], typeof PROJECT_STATUSES>
>
export type GoalHorizonsMatchDb = Assert<SameMembers<Enums['goal_horizon'], typeof GOAL_HORIZONS>>
export type GoalStatusesMatchDb = Assert<SameMembers<Enums['goal_status'], typeof GOAL_STATUSES>>
export type TransactionTypesMatchDb = Assert<
  SameMembers<Enums['transaction_type'], typeof TRANSACTION_TYPES>
>
export type AccountTypesMatchDb = Assert<SameMembers<Enums['account_type'], typeof ACCOUNT_TYPES>>
export type CategoryKindsMatchDb = Assert<
  SameMembers<Enums['category_kind'], typeof CATEGORY_KINDS>
>
export type InboxStatusesMatchDb = Assert<SameMembers<Enums['inbox_status'], typeof INBOX_STATUSES>>
export type CreatedViaMatchDb = Assert<SameMembers<Enums['created_via'], typeof CREATED_VIA>>

// --- Italian labels ----------------------------------------------------------
// Records keyed by the database union, so a new enum value is a compile error
// here too: there is no screen where a value can render as a blank.

export const TASK_STATUS_LABELS: Record<Enums['task_status'], string> = {
  inbox: 'Da smistare',
  todo: 'Da fare',
  doing: 'In corso',
  blocked: 'Bloccato',
  done: 'Fatto',
  cancelled: 'Annullato',
}

export const PRIORITY_LABELS: Record<Enums['priority_level'], string> = {
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

export const PROJECT_STATUS_LABELS: Record<Enums['project_status'], string> = {
  idea: 'Idea',
  active: 'Attivo',
  paused: 'In pausa',
  done: 'Concluso',
  archived: 'Archiviato',
}

export const GOAL_HORIZON_LABELS: Record<Enums['goal_horizon'], string> = {
  yearly: 'Annuale',
  quarterly: 'Trimestrale',
  monthly: 'Mensile',
  weekly: 'Settimanale',
}

export const GOAL_STATUS_LABELS: Record<Enums['goal_status'], string> = {
  active: 'Attivo',
  paused: 'In pausa',
  done: 'Raggiunto',
  abandoned: 'Abbandonato',
}

export const ACCOUNT_TYPE_LABELS: Record<Enums['account_type'], string> = {
  cash: 'Contanti',
  bank: 'Conto bancario',
  card: 'Carta',
  savings: 'Risparmi',
  other: 'Altro',
}
