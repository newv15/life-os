import { z } from 'zod'
import { text } from '@/lib/validation/common'

/**
 * What a list needs to be unambiguous.
 *
 * Almost nothing, which is the point: a list is a name and lines under it. The
 * rules here exist only to stop one list from quietly becoming two - a stray
 * space, an empty line - because the assistant resolves lists by name and an
 * ambiguity there means items landing where nobody will look for them.
 */

export const createListSchema = z.object({
  name: text(80),
  /**
   * Default false: the common case is the shopping list, which empties itself.
   * A list that keeps its history is a decision, and decisions get declared.
   */
  keepsHistory: z.boolean().default(false),
})

export const addItemsSchema = z.object({
  listName: text(80),
  items: z
    .array(z.string())
    // Dictated items arrive as the model split them, and a trailing "e..." or a
    // double comma leaves blanks behind. Dropping them here is friendlier than
    // refusing the whole sentence over one empty slot.
    .transform((values) => values.map((value) => value.trim()).filter((value) => value !== ''))
    .refine((values) => values.length > 0, 'Serve almeno una voce.')
    .refine((values) => values.every((value) => value.length <= 200), 'Voce troppo lunga.'),
})

export const listItemTextSchema = text(200)
