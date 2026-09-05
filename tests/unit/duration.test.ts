import { describe, expect, it } from 'vitest'
import { formatDuration, secondsBetween } from '@/lib/utils/duration'

describe('formatDuration', () => {
  it('shows minutes on their own under an hour', () => {
    expect(formatDuration(1800)).toBe('30 min')
  })

  it('shows hours and minutes together', () => {
    expect(formatDuration(3600 + 25 * 60)).toBe('1h 25min')
  })

  it('drops the minutes when there are none', () => {
    expect(formatDuration(7200)).toBe('2h')
  })

  it('rounds seconds into the nearest minute', () => {
    // A stopwatch reading "1h 25min 03s" is precision nobody asked for.
    expect(formatDuration(3600 + 25 * 60 + 40)).toBe('1h 26min')
  })

  it('says less than a minute rather than showing zero', () => {
    expect(formatDuration(30)).toBe('meno di 1 min')
    expect(formatDuration(0)).toBe('meno di 1 min')
  })

  it('treats a negative span as nothing rather than printing a minus', () => {
    expect(formatDuration(-100)).toBe('meno di 1 min')
  })
})

describe('secondsBetween', () => {
  it('measures a closed span', () => {
    expect(secondsBetween('2026-09-05T10:00:00Z', '2026-09-05T11:30:00Z')).toBe(5400)
  })

  it('measures an open span against now', () => {
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const seconds = secondsBetween(oneMinuteAgo, null)

    expect(seconds).toBeGreaterThanOrEqual(59)
    expect(seconds).toBeLessThan(65)
  })
})
