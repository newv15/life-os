import { z } from 'zod'
import { defineTool } from '@/lib/ai/tools/types'
import { ValidationError } from '@/lib/services/errors'
import {
  addItems,
  clearChecked,
  findItemByText,
  getList,
  listLists,
  setItemChecked,
} from '@/lib/services/lists'
import { selectListByName } from '@/lib/db/repositories/lists'
import type { Db } from '@/lib/db/types'

/**
 * Lists, spoken rather than typed.
 *
 * This is where the module earns its place: standing in a shop, saying "aggiungi
 * latte e pane alla spesa". Every summary names what was written and where, so
 * a misheard word is visible immediately rather than discovered next week in
 * front of an empty shelf.
 */

/** Shared by the three tools that need a list that already exists. */
async function requireList(db: Db, userId: string, name: string) {
  const list = await selectListByName(db, userId, name)
  if (list) return list

  const available = (await listLists(db, userId)).map((entry) => entry.name)
  throw new ValidationError(
    available.length > 0
      ? `Non ho una lista che si chiama «${name}». Ci sono: ${available.join(', ')}. Chiedi quale intende.`
      : `Non c'è ancora nessuna lista. Puoi crearne una aggiungendoci qualcosa.`,
  )
}

export const addToListTool = defineTool({
  name: 'add_to_list',
  description:
    'Aggiunge una o più voci a una lista di cose da spuntare: la spesa, cosa mettere in valigia, ' +
    'i film da vedere, i libri da leggere. Se la lista non esiste la crea. ' +
    'Non usarlo per cose da fare con una scadenza o un orario: per quelle c\'è create_task.',
  parameters: z.object({
    listName: z
      .string()
      .describe('Come la persona chiama la lista, ad esempio "spesa" o "libri da leggere".'),
    items: z
      .array(z.string())
      .describe('Le voci da aggiungere, una per elemento, come le ha dette la persona.'),
  }),
  async execute(ctx, args) {
    const { list, createdList, items } = await addItems(
      ctx.db,
      ctx.userId,
      { listName: args.listName, items: args.items },
      ctx.channel === 'telegram' ? 'telegram' : 'ai',
    )

    const written = items.map((item) => item.text).join(', ')

    return {
      summary: createdList
        ? `Ho creato la lista «${list.name}» e ci ho messo: ${written}.`
        : `Aggiunto a «${list.name}»: ${written}.`,
      data: { listId: list.id, aggiunte: items.length },
    }
  },
})

export const checkListItemTool = defineTool({
  name: 'check_list_item',
  description:
    'Segna come fatta una voce di una lista ("ho preso il latte", "ho visto Dune"). ' +
    'La voce viene cercata fra quelle ancora da spuntare di quella lista.',
  parameters: z.object({
    listName: z.string().describe('La lista in cui si trova la voce.'),
    item: z.string().describe('La voce da spuntare, anche solo con la parola che la identifica.'),
  }),
  async execute(ctx, args) {
    const list = await requireList(ctx.db, ctx.userId, args.listName)
    const matches = await findItemByText(ctx.db, ctx.userId, list.id, args.item)

    // Spuntare la cosa sbagliata è peggio che non spuntare niente: la voce
    // giusta resta lì credendo di essere fatta, e nessuno se ne accorge.
    if (matches.length === 0) {
      throw new ValidationError(
        `Nella lista «${list.name}» non trovo niente che assomigli a "${args.item}". Chiedi alla persona quale voce intende.`,
      )
    }

    if (matches.length > 1) {
      throw new ValidationError(
        `In «${list.name}» ci sono più voci che corrispondono a "${args.item}": ` +
          `${matches.map((item) => item.text).join(', ')}. Chiedi quale intende.`,
      )
    }

    const done = await setItemChecked(ctx.db, ctx.userId, matches[0].id, true)

    return {
      summary: `Spuntato «${done.text}» da ${list.name}.`,
      data: { listId: list.id, itemId: done.id },
    }
  },
})

export const showListTool = defineTool({
  name: 'show_list',
  description:
    'Legge una lista e dice cosa resta da spuntare. Senza nome, elenca le liste esistenti ' +
    'con quante voci mancano in ciascuna.',
  parameters: z.object({
    listName: z
      .string()
      .nullish()
      .describe('La lista da leggere. Ometti per avere l\'elenco di tutte le liste.'),
  }),
  async execute(ctx, args) {
    if (!args.listName || args.listName.trim() === '') {
      const lists = await listLists(ctx.db, ctx.userId)

      if (lists.length === 0) {
        return { summary: 'Non hai ancora nessuna lista.', data: { liste: [] } }
      }

      return {
        summary: lists
          .map((list) => `${list.name}: ${list.total - list.checked} da fare`)
          .join(' · '),
        data: {
          liste: lists.map((list) => ({
            nome: list.name,
            daFare: list.total - list.checked,
            totale: list.total,
          })),
        },
      }
    }

    const list = await requireList(ctx.db, ctx.userId, args.listName)
    const { items } = await getList(ctx.db, ctx.userId, list.id)

    const open = items.filter((item) => item.checked_at === null)

    return {
      summary:
        open.length === 0
          ? `Nella lista «${list.name}» non resta niente da fare.`
          : `${list.name}: ${open.map((item) => item.text).join(', ')}.`,
      data: {
        nome: list.name,
        daFare: open.map((item) => item.text),
        fatte: items.filter((item) => item.checked_at !== null).map((item) => item.text),
      },
    }
  },
})

export const clearCheckedTool = defineTool({
  name: 'clear_checked',
  description:
    'Toglie da una lista le voci già spuntate, per riusarla dalla prossima volta ' +
    '("svuota la spesa"). Non funziona sulle liste che tengono lo storico.',
  parameters: z.object({
    listName: z.string().describe('La lista da ripulire.'),
  }),
  async execute(ctx, args) {
    const list = await requireList(ctx.db, ctx.userId, args.listName)
    const removed = await clearChecked(ctx.db, ctx.userId, list.id)

    return {
      summary:
        removed === 0
          ? `In «${list.name}» non c'era niente di spuntato da togliere.`
          : `Tolte ${removed} voci spuntate da «${list.name}».`,
      data: { listId: list.id, tolte: removed },
    }
  },
})
