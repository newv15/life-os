import { describe, expect, it, vi } from 'vitest'
import { searchEverything, hrefForEntity } from '@/lib/services/search'
import type { Db } from '@/lib/db/types'

type Rpc = ReturnType<typeof vi.fn>

/** A database that only knows how to answer the search function. */
function fakeDb(rows: unknown[]): { db: Db; rpc: Rpc } {
  const rpc = vi.fn(async () => ({ data: rows, error: null }))
  return { db: { rpc } as unknown as Db, rpc }
}

describe('hrefForEntity', () => {
  it('points every searchable kind at the screen that shows it', () => {
    expect(hrefForEntity('task', 'abc')).toBe('/tasks?focus=abc')
    expect(hrefForEntity('project', 'abc')).toBe('/projects?focus=abc')
    expect(hrefForEntity('goal', 'abc')).toBe('/goals?focus=abc')
    expect(hrefForEntity('event', 'abc')).toBe('/calendar?focus=abc')
    expect(hrefForEntity('transaction', 'abc')).toBe('/finance?focus=abc')
    expect(hrefForEntity('person', 'abc')).toBe('/people?focus=abc')
    expect(hrefForEntity('inbox_item', 'abc')).toBe('/inbox?focus=abc')
  })

  it('has no destination for kinds without a screen', () => {
    expect(hrefForEntity('memory', 'abc')).toBeNull()
    expect(hrefForEntity('note', 'abc')).toBeNull()
  })
})

describe('searchEverything', () => {
  it('does not query the database for a query too short to mean anything', async () => {
    const { db, rpc } = fakeDb([])

    expect(await searchEverything(db, 'user-1', 'a')).toEqual([])
    expect(await searchEverything(db, 'user-1', '   ')).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('sends the trimmed query to the database function', async () => {
    const { db, rpc } = fakeDb([])

    await searchEverything(db, 'user-1', '  spesa  ')

    expect(rpc).toHaveBeenCalledWith('global_search', {
      p_user_id: 'user-1',
      p_query: 'spesa',
      p_limit: 20,
    })
  })

  it('gives each hit a destination', async () => {
    const { db } = fakeDb([
      {
        entity_type: 'task',
        entity_id: 'task-1',
        title: 'Comprare il pane',
        snippet: 'integrale',
        occurred_at: '2026-09-01T08:00:00Z',
        rank: 0.9,
      },
    ])

    expect(await searchEverything(db, 'user-1', 'pane')).toEqual([
      {
        entityType: 'task',
        id: 'task-1',
        title: 'Comprare il pane',
        snippet: 'integrale',
        href: '/tasks?focus=task-1',
        occurredAt: '2026-09-01T08:00:00Z',
      },
    ])
  })

  it('drops hits that lead nowhere', async () => {
    // A result nobody can open is worse than no result: it costs a click and
    // returns nothing.
    const { db } = fakeDb([
      { entity_type: 'memory', entity_id: 'm-1', title: 'Beve caffè', snippet: '', rank: 1 },
      { entity_type: 'task', entity_id: 't-1', title: 'Caffè', snippet: '', rank: 0.5 },
    ])

    const hits = await searchEverything(db, 'user-1', 'caffè')

    expect(hits.map((hit) => hit.id)).toEqual(['t-1'])
  })
})
