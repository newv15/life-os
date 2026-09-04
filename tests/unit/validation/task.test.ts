import { describe, expect, it } from 'vitest'
import { createTaskSchema, updateTaskSchema } from '@/lib/validation/task'

/**
 * One schema, two callers: the web form (strings out of a FormData) and, from
 * M3, the AI tool registry (JSON out of a model). If they validated separately
 * they would drift, and the bot would start accepting things the form rejects.
 *
 * So the schema takes loose input and returns a normalised value, and every
 * test here is a rule both callers inherit.
 */

describe('createTaskSchema', () => {
  it('trims the title and fills in the defaults', () => {
    const task = createTaskSchema.parse({ title: '  Chiamare il commercialista  ' })

    expect(task.title).toBe('Chiamare il commercialista')
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('medium')
    expect(task.dueAt).toBeNull()
    expect(task.projectId).toBeNull()
  })

  it.each(['', '   ', '\n\t'])('rejects a title that is only whitespace: %j', (title) => {
    expect(createTaskSchema.safeParse({ title }).success).toBe(false)
  })

  it('rejects a title longer than the column allows', () => {
    expect(createTaskSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false)
  })

  it('reads a bare wall clock as local time, not UTC', () => {
    const task = createTaskSchema.parse({
      title: 'Dal commercialista',
      dueAt: '2026-09-05T10:00',
    })

    // 10:00 in Rome during summer time is 08:00Z. Storing 10:00Z would fire
    // the reminder two hours late.
    expect(task.dueAt?.toISOString()).toBe('2026-09-05T08:00:00.000Z')
  })

  it('refuses a due date it cannot pin down instead of guessing', () => {
    const result = createTaskSchema.safeParse({ title: 'Qualcosa', dueAt: 'venerdì' })

    expect(result.success).toBe(false)
  })

  it('treats an empty due date as no due date, the way a blank form field arrives', () => {
    expect(createTaskSchema.parse({ title: 'Qualcosa', dueAt: '' }).dueAt).toBeNull()
  })

  it('accepts an estimate in whole minutes', () => {
    expect(createTaskSchema.parse({ title: 'X', estimatedMinutes: '45' }).estimatedMinutes).toBe(45)
  })

  it.each(['0', '-10', '1.5'])('rejects a nonsensical estimate: %j', (estimatedMinutes) => {
    expect(createTaskSchema.safeParse({ title: 'X', estimatedMinutes }).success).toBe(false)
  })

  it('treats a blank estimate as no estimate, not as zero', () => {
    expect(createTaskSchema.parse({ title: 'X', estimatedMinutes: '' }).estimatedMinutes).toBeNull()
  })

  it('treats a blank id as no link, the way an unselected dropdown arrives', () => {
    expect(createTaskSchema.parse({ title: 'X', projectId: '' }).projectId).toBeNull()
  })

  it('rejects a priority outside the enum', () => {
    expect(createTaskSchema.safeParse({ title: 'X', priority: 'altissima' }).success).toBe(false)
  })

  it('accepts the reduced recurrence model', () => {
    const task = createTaskSchema.parse({
      title: 'Palestra',
      recurrence: { freq: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] },
    })

    expect(task.recurrence).toEqual({ freq: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] })
  })

  it('rejects a weekday number that does not exist', () => {
    const result = createTaskSchema.safeParse({
      title: 'Palestra',
      recurrence: { freq: 'weekly', interval: 1, daysOfWeek: [0, 8] },
    })

    expect(result.success).toBe(false)
  })

  it('rejects an id that is not a uuid, so a bad link fails before reaching the database', () => {
    expect(createTaskSchema.safeParse({ title: 'X', projectId: 'progetto-yume' }).success).toBe(
      false,
    )
  })

  it('never accepts a user_id from the caller', () => {
    const task = createTaskSchema.parse({
      title: 'X',
      userId: '00000000-0000-0000-0000-000000000000',
    })

    // The owner is injected by the server. Anything the model or the form says
    // about ownership is dropped here, before it can reach a query.
    expect(task).not.toHaveProperty('userId')
    expect(task).not.toHaveProperty('user_id')
  })
})

describe('updateTaskSchema', () => {
  it('allows a partial change without re-sending the whole task', () => {
    const patch = updateTaskSchema.parse({ priority: 'urgent' })

    expect(patch).toEqual({ priority: 'urgent' })
  })

  it('distinguishes clearing a due date from leaving it alone', () => {
    expect(updateTaskSchema.parse({ dueAt: '' }).dueAt).toBeNull()
    expect(updateTaskSchema.parse({}).dueAt).toBeUndefined()
  })

  it('still applies the same rules as creation', () => {
    expect(updateTaskSchema.safeParse({ title: '   ' }).success).toBe(false)
    expect(updateTaskSchema.safeParse({ dueAt: 'domani' }).success).toBe(false)
  })
})
