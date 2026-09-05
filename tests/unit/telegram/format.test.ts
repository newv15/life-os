import { describe, expect, it } from 'vitest'
import { escapeHtml, parseCommand, splitForTelegram } from '@/lib/telegram/format'

describe('parseCommand', () => {
  it('reads a bare command', () => {
    expect(parseCommand('/today')).toEqual({ command: 'today', args: '' })
  })

  it('reads a command with an argument', () => {
    expect(parseCommand('/link ABC12345')).toEqual({ command: 'link', args: 'ABC12345' })
  })

  it('keeps the whole rest of the line as the argument', () => {
    expect(parseCommand('/add comprare il pane domani')).toEqual({
      command: 'add',
      args: 'comprare il pane domani',
    })
  })

  it('strips the bot mention Telegram appends in groups', () => {
    // In a group chat Telegram sends "/today@nome_bot", and a naive parser
    // then looks for a command called "today@nome_bot".
    expect(parseCommand('/today@life_os_bot')).toEqual({ command: 'today', args: '' })
  })

  it('lowercases the command but not the argument', () => {
    expect(parseCommand('/LINK Ab12Cd34')).toEqual({ command: 'link', args: 'Ab12Cd34' })
  })

  it('is not a command when it is just a sentence', () => {
    expect(parseCommand('ho speso 35 euro')).toBeNull()
  })

  it('is not a command when the slash stands alone', () => {
    expect(parseCommand('/')).toBeNull()
    expect(parseCommand('/ ')).toBeNull()
  })

  it('is not a command when the slash is in the middle', () => {
    expect(parseCommand('vado a casa / poi torno')).toBeNull()
  })

  it('tolerates leading whitespace', () => {
    expect(parseCommand('  /help')).toEqual({ command: 'help', args: '' })
  })
})

describe('escapeHtml', () => {
  it('escapes the three characters Telegram parses as markup', () => {
    expect(escapeHtml('<b>ciao</b> & addio')).toBe('&lt;b&gt;ciao&lt;/b&gt; &amp; addio')
  })

  it('leaves ordinary Italian text alone, accents included', () => {
    expect(escapeHtml('Perché è così?')).toBe('Perché è così?')
  })

  it('escapes the ampersand first, so escapes are not double-escaped', () => {
    // Getting the order wrong turns "<" into "&amp;lt;" and the user sees the
    // escape sequence rather than the character.
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })
})

describe('splitForTelegram', () => {
  it('leaves a short message in one piece', () => {
    expect(splitForTelegram('ciao')).toEqual(['ciao'])
  })

  it('splits a message longer than the API allows', () => {
    // Telegram rejects anything over 4096 characters outright, so a long
    // weekly summary would simply never arrive.
    const long = 'a'.repeat(9000)
    const parts = splitForTelegram(long)

    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(4096)
    expect(parts.join('')).toBe(long)
  })

  it('prefers to break at a line ending', () => {
    const paragraph = `${'a'.repeat(4000)}\n${'b'.repeat(4000)}`
    const parts = splitForTelegram(paragraph)

    expect(parts[0]).toBe('a'.repeat(4000))
  })
})
