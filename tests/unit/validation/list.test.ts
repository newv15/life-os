import { describe, expect, it } from 'vitest'
import { addItemsSchema, createListSchema } from '@/lib/validation/list'

/**
 * A list is the lightest thing in the system: a name, and lines under it. So
 * the only rules worth having are the ones that stop it from becoming
 * ambiguous - an empty name, an empty line, a stray space that turns one list
 * into two.
 */

describe('createListSchema', () => {
  it('rifiuta un nome vuoto', () => {
    expect(createListSchema.safeParse({ name: '  ', keepsHistory: false }).success).toBe(false)
  })

  it('toglie gli spazi ai lati, che sono un errore di battitura e non un nome', () => {
    expect(createListSchema.parse({ name: '  Spesa ', keepsHistory: false }).name).toBe('Spesa')
  })

  it('si svuota, se non è stato detto altrimenti', () => {
    // Il caso comune è la spesa. Una lista che tiene lo storico è una scelta,
    // e le scelte si dichiarano.
    expect(createListSchema.parse({ name: 'Spesa' }).keepsHistory).toBe(false)
  })
})

describe('addItemsSchema', () => {
  it('scarta le righe vuote invece di creare voci senza testo', () => {
    const parsed = addItemsSchema.parse({ listName: 'Spesa', items: ['Latte', '  ', 'Pane'] })

    expect(parsed.items).toEqual(['Latte', 'Pane'])
  })

  it('rifiuta un elenco che dopo la pulizia è vuoto', () => {
    expect(addItemsSchema.safeParse({ listName: 'Spesa', items: ['   '] }).success).toBe(false)
  })

  it('accetta una voce sola, che è come si parla al bot', () => {
    expect(addItemsSchema.parse({ listName: 'Spesa', items: ['Latte'] }).items).toEqual(['Latte'])
  })

  it('pretende il nome della lista', () => {
    expect(addItemsSchema.safeParse({ listName: '', items: ['Latte'] }).success).toBe(false)
  })
})
