import { describe, expect, it } from 'vitest'
import {
  InvalidAmountError,
  formatEUR,
  formatSignedEUR,
  parseAmount,
} from '@/lib/utils/currency'

describe('formatEUR', () => {
  it('uses Italian grouping and decimal separators', () => {
    expect(formatEUR(1234.5)).toBe('1.234,50 €')
  })

  it('always shows two decimals', () => {
    expect(formatEUR(35)).toBe('35,00 €')
  })

  it('accepts the string form the database returns for numeric columns', () => {
    expect(formatEUR('35.00')).toBe('35,00 €')
  })

  it('marks direction without relying on colour alone', () => {
    expect(formatSignedEUR(35, 'out')).toBe('−35,00 €')
    expect(formatSignedEUR(35, 'in')).toBe('+35,00 €')
  })
})

describe('parseAmount', () => {
  it.each([
    ['35', 35],
    ['35,50', 35.5],
    ['35.50', 35.5],
    ['0,99', 0.99],
    ['1234', 1234],
  ])('reads a plain amount %j', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })

  it('reads Italian grouping with decimals', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56)
  })

  it('reads English grouping with decimals, as a model may emit', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56)
  })

  it('treats a lone dot before three digits as grouping, not a decimal point', () => {
    // "1.234 euro" in Italian is one thousand two hundred thirty-four.
    expect(parseAmount('1.234')).toBe(1234)
    expect(parseAmount('1.234.567')).toBe(1234567)
  })

  it('treats a lone dot before one or two digits as a decimal point', () => {
    expect(parseAmount('35.5')).toBe(35.5)
    expect(parseAmount('35.50')).toBe(35.5)
  })

  it('tolerates currency symbols, words and spacing', () => {
    expect(parseAmount('€ 35,00')).toBe(35)
    expect(parseAmount('35 euro')).toBe(35)
    expect(parseAmount('  1.234,56 €  ')).toBe(1234.56)
  })

  it('keeps a leading minus sign', () => {
    expect(parseAmount('-35,50')).toBe(-35.5)
    expect(parseAmount('−35,50')).toBe(-35.5)
  })

  it('rounds to the cent rather than carrying float noise', () => {
    expect(parseAmount('35,555')).toBe(35.56)
  })

  it.each(['', 'trentacinque', 'abc', '35,,50', '3,5,7', '€'])(
    'refuses %j instead of recording a wrong transaction',
    (input) => {
      expect(() => parseAmount(input)).toThrow(InvalidAmountError)
    },
  )
})
