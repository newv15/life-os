/**
 * Turning a name the model said into a row that exists.
 *
 * A model cannot know a UUID, so it names things. The rule here is the one
 * from the architecture: resolve against the user's real list, and when it
 * does not resolve, say so. Never fall back to "the first one" - a spend filed
 * under the wrong category is worse than a spend the system had to ask about,
 * because nobody goes back to check.
 */

type Named = { id: string; name: string }

/**
 * Every combining mark, by Unicode category rather than by a literal range:
 * the marks themselves are invisible in source and easy to mangle in an edit.
 */
const COMBINING_MARKS = /\p{M}/gu

/** Lowercase, unaccented, trimmed - what "the same name" actually means here. */
function normalise(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')
}

export function matchByName<T extends Named>(
  items: readonly T[],
  name: string | null | undefined,
): T | null {
  if (!name) return null

  const needle = normalise(name)
  if (needle === '') return null

  // An exact name always wins, even when a longer name contains it.
  const exact = items.filter((item) => normalise(item.name) === needle)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null

  const partial = items.filter((item) => normalise(item.name).includes(needle))

  // Exactly one candidate is a match; several is a question for the user.
  return partial.length === 1 ? partial[0] : null
}
