import { describe, expect, it } from 'vitest'
import { matchByName } from '@/lib/ai/tools/resolve'

/**
 * Turning what the model said into something that exists.
 *
 * A model cannot know a UUID, so it names things: "spesa alimentare", "conto
 * principale". This is where a name becomes a row - and, just as importantly,
 * where a name that matches nothing stays nothing instead of becoming the
 * first row in the list.
 */

const categories = [
  { id: 'a', name: 'Spesa alimentare' },
  { id: 'b', name: 'Ristoranti e bar' },
  { id: 'c', name: 'Trasporti' },
  { id: 'd', name: 'Tasse e imposte' },
  { id: 'e', name: 'Altro' },
]

describe('matchByName', () => {
  it('finds an exact name', () => {
    expect(matchByName(categories, 'Trasporti')?.id).toBe('c')
  })

  it('ignores case', () => {
    expect(matchByName(categories, 'trasporti')?.id).toBe('c')
  })

  it('ignores surrounding whitespace', () => {
    expect(matchByName(categories, '  Trasporti  ')?.id).toBe('c')
  })

  it('ignores accents, which get dropped when dictating', () => {
    expect(matchByName([{ id: 'x', name: 'Università' }], 'universita')?.id).toBe('x')
  })

  it('accepts a name that starts the same way', () => {
    expect(matchByName(categories, 'spesa')?.id).toBe('a')
  })

  it('accepts a name contained in the real one', () => {
    expect(matchByName(categories, 'ristoranti')?.id).toBe('b')
  })

  it('refuses to choose when two candidates fit equally', () => {
    // "tas" matches both Trasporti and Tasse. Picking one would be a coin
    // flip recorded as fact, so it asks instead.
    const ambiguous = [
      { id: '1', name: 'Tasse e imposte' },
      { id: '2', name: 'Tassa rifiuti' },
    ]
    expect(matchByName(ambiguous, 'tass')).toBeNull()
  })

  it('returns nothing for a name that matches nothing', () => {
    // The important half: an unknown category must not silently become
    // whatever happened to be first.
    expect(matchByName(categories, 'criptovalute')).toBeNull()
  })

  it('returns nothing for an empty or missing name', () => {
    expect(matchByName(categories, '')).toBeNull()
    expect(matchByName(categories, null)).toBeNull()
    expect(matchByName(categories, undefined)).toBeNull()
  })

  it('prefers an exact match over a longer name that contains it', () => {
    const items = [
      { id: 'long', name: 'Altro conto' },
      { id: 'exact', name: 'Altro' },
    ]
    expect(matchByName(items, 'Altro')?.id).toBe('exact')
  })
})
