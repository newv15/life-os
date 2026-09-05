import { NotFoundError, parseOrThrow } from '@/lib/services/errors'
import {
  deleteEventRow,
  insertEvent,
  selectEventById,
  selectEvents,
  updateEventRow,
  type EventFilters,
  type EventRow,
} from '@/lib/db/repositories/calendar'
import { createEventSchema, updateEventSchema } from '@/lib/validation/event'
import { endOfDayInTimeZone, startOfDayInTimeZone } from '@/lib/utils/date'
import type { Db, Enums } from '@/lib/db/types'

export type { EventRow, EventFilters }

export async function createEvent(
  db: Db,
  userId: string,
  input: unknown,
  createdVia: Enums['created_via'] = 'web',
): Promise<EventRow> {
  const data = parseOrThrow(createEventSchema, input)

  return insertEvent(db, userId, {
    title: data.title,
    description: data.description,
    starts_at: data.startsAt.toISOString(),
    ends_at: data.endsAt?.toISOString() ?? null,
    all_day: data.allDay,
    location: data.location,
    project_id: data.projectId,
    person_id: data.personId,
    created_via: createdVia,
  })
}

export async function getEvent(db: Db, userId: string, id: string): Promise<EventRow | null> {
  return selectEventById(db, userId, id)
}

export async function listEvents(
  db: Db,
  userId: string,
  filters: EventFilters = {},
): Promise<EventRow[]> {
  return selectEvents(db, userId, filters)
}

/** Everything happening on one calendar day, in the user's own timezone. */
export async function listEventsOnDay(
  db: Db,
  userId: string,
  isoDate: string,
  timezone?: string,
): Promise<EventRow[]> {
  return selectEvents(db, userId, {
    from: startOfDayInTimeZone(isoDate, timezone).toISOString(),
    before: endOfDayInTimeZone(isoDate, timezone).toISOString(),
  })
}

/**
 * Edits are checked against the resulting event, not the change alone.
 *
 * Moving only the end has to be judged against the start already stored, or
 * the rule simply does not fire and the database answers with a constraint
 * name instead of a sentence a person can act on.
 */
export async function updateEvent(
  db: Db,
  userId: string,
  id: string,
  input: unknown,
): Promise<EventRow> {
  const data = parseOrThrow(updateEventSchema, input)

  const current = await selectEventById(db, userId, id)
  if (!current) throw new NotFoundError('Evento non trovato.')

  parseOrThrow(createEventSchema, {
    title: data.title ?? current.title,
    startsAt: data.startsAt !== undefined ? data.startsAt : current.starts_at,
    endsAt: data.endsAt !== undefined ? data.endsAt : current.ends_at,
    allDay: data.allDay ?? current.all_day,
    location: data.location !== undefined ? data.location : current.location,
    description: data.description !== undefined ? data.description : current.description,
    projectId: data.projectId !== undefined ? data.projectId : current.project_id,
    personId: data.personId !== undefined ? data.personId : current.person_id,
  })

  const patch: Parameters<typeof updateEventRow>[3] = {}
  if (data.title !== undefined) patch.title = data.title
  if (data.description !== undefined) patch.description = data.description
  if (data.startsAt !== undefined) patch.starts_at = data.startsAt?.toISOString()
  if (data.endsAt !== undefined) patch.ends_at = data.endsAt?.toISOString() ?? null
  if (data.allDay !== undefined) patch.all_day = data.allDay
  if (data.location !== undefined) patch.location = data.location
  if (data.projectId !== undefined) patch.project_id = data.projectId
  if (data.personId !== undefined) patch.person_id = data.personId

  const updated = await updateEventRow(db, userId, id, patch)
  if (!updated) throw new NotFoundError('Evento non trovato.')
  return updated
}

export async function deleteEvent(db: Db, userId: string, id: string): Promise<void> {
  await deleteEventRow(db, userId, id)
}
