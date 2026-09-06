import { describe, expect, it } from 'vitest'
import { toCSV } from '@/lib/services/export'

/**
 * The only reason to want CSV rather than the JSON backup is to open the file
 * in a spreadsheet, so these tests describe what a spreadsheet needs, not what
 * a parser would prefer.
 */
describe('toCSV', () => {
  it('writes the columns in the order they are given', () => {
    const csv = toCSV([{ data: '2026-09-01', importo: 35, descrizione: 'Spesa' }])

    expect(csv.split('\r\n')[0]).toBe('﻿data;importo;descrizione')
  })

  it('starts with a byte order mark, so accented text survives Excel', () => {
    expect(toCSV([{ nome: 'Perché' }]).startsWith('﻿')).toBe(true)
  })

  it('writes numbers with the Italian decimal comma', () => {
    // The file is separated by semicolons precisely so that this is possible:
    // an amount written 35.50 is read as a date by an Italian spreadsheet.
    expect(toCSV([{ importo: 35.5 }])).toContain('35,5')
  })

  it('treats an amount the way the database hands it over: as a string', () => {
    // Every money column is numeric(12,2), and the driver returns those as
    // text so the last cent survives. Missing this is how the entire amounts
    // column would land in the spreadsheet as dates.
    expect(toCSV([{ importo: '35.50' }])).toContain('35,50')
  })

  it('leaves alone text that merely contains a dot', () => {
    expect(toCSV([{ nota: 'versione 1.2.3' }])).toContain('versione 1.2.3')
    expect(toCSV([{ data: '2026-09-01' }])).toContain('2026-09-01')
  })

  it('quotes a value containing the separator, and leaves the rest bare', () => {
    const csv = toCSV([{ nota: 'pane; latte', altro: 'niente' }])

    expect(csv.split('\r\n')[1]).toBe('"pane; latte";niente')
  })

  it('doubles the quotes inside a quoted value', () => {
    expect(toCSV([{ nota: 'ha detto "sì"' }]).split('\r\n')[1]).toBe('"ha detto ""sì"""')
  })

  it('keeps a value with a line break in one cell', () => {
    expect(toCSV([{ nota: 'prima\nseconda' }]).split('\r\n')[1]).toBe('"prima\nseconda"')
  })

  it('leaves the cell empty for something that was never filled in', () => {
    expect(toCSV([{ a: null, b: undefined, c: 'x' }]).split('\r\n')[1]).toBe(';;x')
  })

  it('flattens what a json column holds, rather than printing [object Object]', () => {
    expect(toCSV([{ config: { time_of_day: '07:30' } }]).split('\r\n')[1]).toBe(
      '"{""time_of_day"":""07:30""}"',
    )
  })

  it('returns nothing at all for no rows, rather than a lone header', () => {
    expect(toCSV([])).toBe('')
  })
})
