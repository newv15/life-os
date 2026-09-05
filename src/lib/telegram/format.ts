/**
 * Turning messages into something Telegram accepts.
 *
 * Small, unglamorous rules, each of which breaks a real message if missed: a
 * command with the bot's @name appended, an ampersand in a description, a
 * weekly summary longer than the API will carry.
 */

/** Telegram rejects any message over this, rather than truncating it. */
const MAX_MESSAGE_LENGTH = 4096

export type ParsedCommand = { command: string; args: string }

/**
 * Reads a slash command, or decides this is ordinary speech.
 *
 * Natural language is the main way to use the bot, so anything that is not
 * unmistakably a command has to fall through to the AI untouched.
 */
export function parseCommand(text: string): ParsedCommand | null {
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('/')) return null

  const [head, ...rest] = trimmed.slice(1).split(/\s+/)
  // In a group Telegram appends the bot's username: "/today@life_os_bot".
  const command = head.split('@')[0].toLowerCase()

  if (command === '') return null

  return { command, args: rest.join(' ').trim() }
}

/**
 * Escapes the three characters Telegram's HTML mode parses as markup.
 *
 * The ampersand goes first on purpose: doing it last would re-escape the
 * escapes and the person would read "&amp;lt;" instead of "<".
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Cuts a long message into pieces the API will carry, preferring line breaks.
 *
 * Without this a long weekly summary is not truncated - it simply never
 * arrives, and the failure is invisible from the phone.
 */
export function splitForTelegram(text: string, limit = MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= limit) return [text]

  const parts: string[] = []
  let rest = text

  while (rest.length > limit) {
    const window = rest.slice(0, limit)
    const breakAt = window.lastIndexOf('\n')

    // Only break at a newline if it is not so early that the message becomes
    // a dribble of tiny fragments.
    const cut = breakAt > limit * 0.5 ? breakAt : limit

    parts.push(rest.slice(0, cut))
    rest = rest.slice(cut === breakAt ? cut + 1 : cut)
  }

  if (rest.length > 0) parts.push(rest)
  return parts
}
