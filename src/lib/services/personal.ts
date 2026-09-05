import { ConflictError, NotFoundError, parseOrThrow, translateDbError } from '@/lib/services/errors'
import {
  createPersonSchema,
  journalEntrySchema,
  startTimerSchema,
  updatePersonSchema,
  updateTimeEntrySchema,
} from '@/lib/validation/personal'
import { todayISO } from '@/lib/utils/date'
import type { Db, Enums, Row, Update } from '@/lib/db/types'

export type JournalEntryRow = Row<'journal_entries'>
export type PersonRow = Row<'people'>
export type TimeEntryRow = Row<'time_entries'>

// --- Journal -----------------------------------------------------------------

/**
 * Writes the day, or rewrites it.
 *
 * A journal has one entry per day by definition, so coming back in the evening
 * to add a line must update rather than fail. The unique index makes this an
 * upsert; anything else would mean the second thought is the one that gets
 * lost.
 */
export async function saveJournalEntry(
  db: Db,
  userId: string,
  input: unknown,
  createdVia: Enums['created_via'] = 'web',
): Promise<JournalEntryRow> {
  const data = parseOrThrow(journalEntrySchema, input)

  const { data: saved, error } = await db
    .from('journal_entries')
    .upsert(
      {
        user_id: userId,
        entry_date: data.entryDate ?? todayISO(),
        body: data.body,
        energy: data.energy,
        mood: data.mood,
        wins: data.wins,
        blockers: data.blockers,
        reflections: data.reflections,
        next_goals: data.nextGoals,
        created_via: createdVia,
      },
      { onConflict: 'user_id,entry_date' },
    )
    .select('*')
    .single()

  if (error) throw translateDbError(error, 'Salvataggio del diario non riuscito')
  return saved
}

export async function getJournalEntry(
  db: Db,
  userId: string,
  isoDate: string,
): Promise<JournalEntryRow | null> {
  const { data, error } = await db
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', isoDate)
    .maybeSingle()

  if (error) throw translateDbError(error, 'Lettura del diario non riuscita')
  return data
}

export async function listJournalEntries(
  db: Db,
  userId: string,
  limit = 30,
): Promise<JournalEntryRow[]> {
  const { data, error } = await db
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(limit)

  if (error) throw translateDbError(error, 'Lettura del diario non riuscita')
  return data ?? []
}

// --- People ------------------------------------------------------------------

export async function createPerson(
  db: Db,
  userId: string,
  input: unknown,
  createdVia: Enums['created_via'] = 'web',
): Promise<PersonRow> {
  const data = parseOrThrow(createPersonSchema, input)

  const { data: person, error } = await db
    .from('people')
    .insert({
      user_id: userId,
      full_name: data.fullName,
      relationship: data.relationship,
      company: data.company,
      role: data.role,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
      next_action: data.nextAction,
      next_action_at: data.nextActionAt?.toISOString() ?? null,
      last_interaction_at: data.lastInteractionAt?.toISOString() ?? null,
      created_via: createdVia,
    })
    .select('*')
    .single()

  if (error) throw translateDbError(error, 'Creazione del contatto non riuscita')
  return person
}

export async function listPeople(db: Db, userId: string): Promise<PersonRow[]> {
  const { data, error } = await db
    .from('people')
    .select('*')
    .eq('user_id', userId)
    .order('full_name', { ascending: true })

  if (error) throw translateDbError(error, 'Lettura dei contatti non riuscita')
  return data ?? []
}

export async function updatePerson(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
): Promise<PersonRow> {
  const data = parseOrThrow(updatePersonSchema, input)

  const patch: Update<'people'> = {}
  if (data.fullName !== undefined) patch.full_name = data.fullName
  if (data.relationship !== undefined) patch.relationship = data.relationship
  if (data.company !== undefined) patch.company = data.company
  if (data.role !== undefined) patch.role = data.role
  if (data.email !== undefined) patch.email = data.email
  if (data.phone !== undefined) patch.phone = data.phone
  if (data.notes !== undefined) patch.notes = data.notes
  if (data.nextAction !== undefined) patch.next_action = data.nextAction
  if (data.nextActionAt !== undefined) patch.next_action_at = data.nextActionAt?.toISOString() ?? null
  if (data.lastInteractionAt !== undefined) {
    patch.last_interaction_at = data.lastInteractionAt?.toISOString() ?? null
  }

  const { data: person, error } = await db
    .from('people')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Modifica del contatto non riuscita')
  if (!person) throw new NotFoundError('Contatto non trovato.')
  return person
}

export async function deletePerson(db: Db, userId: string, id: string): Promise<void> {
  const { error } = await db.from('people').delete().eq('user_id', userId).eq('id', id)
  if (error) throw translateDbError(error, 'Eliminazione del contatto non riuscita')
}

// --- Time tracking -----------------------------------------------------------

export async function getRunningTimer(db: Db, userId: string): Promise<TimeEntryRow | null> {
  const { data, error } = await db
    .from('time_entries')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle()

  if (error) throw translateDbError(error, 'Lettura del timer non riuscita')
  return data
}

/**
 * Starts the clock, closing whatever was already running.
 *
 * "Ora inizio a lavorare su X" means the previous thing has finished, not that
 * two things are happening at once - and the database only allows one running
 * entry anyway. Closing it first is what the person meant; refusing would make
 * them go and stop it by hand.
 */
export async function startTimer(
  db: Db,
  userId: string,
  input: unknown,
  createdVia: Enums['created_via'] = 'web',
): Promise<{ started: TimeEntryRow; stopped: TimeEntryRow | null }> {
  const data = parseOrThrow(startTimerSchema, input)

  const running = await getRunningTimer(db, userId)
  const stopped = running ? await stopTimer(db, userId) : null

  const { data: started, error } = await db
    .from('time_entries')
    .insert({
      user_id: userId,
      task_id: data.taskId,
      project_id: data.projectId,
      category_id: data.categoryId,
      note: data.note,
      started_at: (data.startedAt ?? new Date()).toISOString(),
      created_via: createdVia,
    })
    .select('*')
    .single()

  if (error) throw translateDbError(error, 'Avvio del timer non riuscito')
  return { started, stopped }
}

export async function stopTimer(db: Db, userId: string): Promise<TimeEntryRow> {
  const running = await getRunningTimer(db, userId)
  if (!running) throw new ConflictError('Nessun timer in corso.')

  const endedAt = new Date()
  // The database rejects an end at or before the start, and a timer stopped
  // within the same second is a mis-tap rather than zero work.
  if (endedAt <= new Date(running.started_at)) endedAt.setTime(new Date(running.started_at).getTime() + 1000)

  const { data, error } = await db
    .from('time_entries')
    .update({ ended_at: endedAt.toISOString() })
    .eq('user_id', userId)
    .eq('id', running.id)
    .select('*')
    .single()

  if (error) throw translateDbError(error, 'Arresto del timer non riuscito')
  return data
}

export async function listTimeEntries(
  db: Db,
  userId: string,
  options: { from?: string; limit?: number } = {},
): Promise<TimeEntryRow[]> {
  let query = db.from('time_entries').select('*').eq('user_id', userId)
  if (options.from) query = query.gte('started_at', options.from)

  const { data, error } = await query
    .order('started_at', { ascending: false })
    .limit(options.limit ?? 50)

  if (error) throw translateDbError(error, 'Lettura del tempo non riuscita')
  return data ?? []
}

export async function updateTimeEntry(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
): Promise<TimeEntryRow> {
  const data = parseOrThrow(updateTimeEntrySchema, input)

  const patch: Update<'time_entries'> = {}
  if (data.taskId !== undefined) patch.task_id = data.taskId
  if (data.projectId !== undefined) patch.project_id = data.projectId
  if (data.categoryId !== undefined) patch.category_id = data.categoryId
  if (data.note !== undefined) patch.note = data.note
  if (data.startedAt !== undefined && data.startedAt) patch.started_at = data.startedAt.toISOString()
  if (data.endedAt !== undefined) patch.ended_at = data.endedAt?.toISOString() ?? null

  const { data: entry, error } = await db
    .from('time_entries')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw translateDbError(error, 'Modifica del tempo non riuscita')
  if (!entry) throw new NotFoundError('Voce non trovata.')
  return entry
}

export async function deleteTimeEntry(db: Db, userId: string, id: string): Promise<void> {
  const { error } = await db.from('time_entries').delete().eq('user_id', userId).eq('id', id)
  if (error) throw translateDbError(error, 'Eliminazione non riuscita')
}

/** Seconds tracked per project over a period, for the summaries. */
export async function timeSummary(
  db: Db,
  userId: string,
  from: string,
): Promise<{ totalSeconds: number; byProject: { projectId: string | null; seconds: number }[] }> {
  const entries = await listTimeEntries(db, userId, { from, limit: 500 })

  let total = 0
  const perProject = new Map<string | null, number>()

  for (const entry of entries) {
    if (!entry.ended_at) continue

    const seconds = Math.round(
      (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 1000,
    )
    total += seconds
    perProject.set(entry.project_id, (perProject.get(entry.project_id) ?? 0) + seconds)
  }

  return {
    totalSeconds: total,
    byProject: [...perProject.entries()]
      .map(([projectId, seconds]) => ({ projectId, seconds }))
      .sort((a, b) => b.seconds - a.seconds),
  }
}
