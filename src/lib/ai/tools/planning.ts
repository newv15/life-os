import { z } from 'zod'
import { defineTool } from '@/lib/ai/tools/types'
import { ABSOLUTE_DATE, optionalMatch } from '@/lib/ai/tools/shared'
import { GOAL_HORIZONS, GOAL_HORIZON_LABELS } from '@/lib/validation/enums'
import { formatEUR } from '@/lib/utils/currency'
import { endOfDayInTimeZone, formatRelativeDay, formatTime, todayISO } from '@/lib/utils/date'
import { createGoal, listGoals, updateGoal } from '@/lib/services/goals'
import { createProject, listProjects } from '@/lib/services/projects'
import { captureInboxItem, listInboxItems } from '@/lib/services/inbox'
import { getFinancialSummary, listAccounts } from '@/lib/services/finance'
import { listTasks } from '@/lib/services/tasks'
import { searchEverything } from '@/lib/services/search'
import { requireMatch } from '@/lib/ai/tools/shared'
import { monthRange } from '@/lib/utils/date'
import type { Enums } from '@/lib/db/types'

// --- Projects ----------------------------------------------------------------

export const createProjectTool = defineTool({
  name: 'create_project',
  description:
    "Crea un progetto, cioè un contenitore di task che servono allo stesso risultato. " +
    'Usalo quando la persona parla di un lavoro più ampio di un singolo task ("il sito per Yume", ' +
    '"il trasloco"), non per una cosa da fare in mezz\'ora.',
  parameters: z.object({
    name: z.string().describe('Nome del progetto, breve e riconoscibile.'),
    goalTitle: z
      .string()
      .nullish()
      .describe("Obiettivo a cui il progetto contribuisce, se la persona l'ha collegato."),
    deadline: z.string().nullish().describe(`Data entro cui va concluso. ${ABSOLUTE_DATE}`),
  }),
  async execute(ctx, args) {
    const goals = await listGoals(ctx.db, ctx.userId)
    const goal = optionalMatch(
      goals.map((g) => ({ id: g.id, name: g.title })),
      args.goalTitle,
      "l'obiettivo",
    )

    const project = await createProject(ctx.db, ctx.userId, {
      name: args.name,
      goalId: goal?.id,
      deadline: args.deadline,
    })

    return {
      summary: `Creato il progetto «${project.name}»${goal ? ` collegato all'obiettivo «${goal.name}»` : ''}.`,
      data: { id: project.id, name: project.name },
    }
  },
})

export const listProjectsTool = defineTool({
  name: 'list_projects',
  description:
    'Elenca i progetti attivi con quanti task contengono e a che punto sono. Usalo per domande ' +
    'su cosa è in corso o su quale progetto è fermo.',
  parameters: z.object({}),
  async execute(ctx) {
    const projects = await listProjects(ctx.db, ctx.userId)

    if (projects.length === 0) return { summary: 'Non ci sono progetti attivi.', data: [] }

    return {
      summary: `${projects.length} progetti attivi.`,
      data: projects.map((p) => ({
        nome: p.name,
        stato: p.status,
        taskCompletati: p.doneCount,
        taskTotali: p.taskCount,
        avanzamento: `${p.progress}%`,
        scadenza: p.deadline,
      })),
    }
  },
})

// --- Goals -------------------------------------------------------------------

export const createGoalTool = defineTool({
  name: 'create_goal',
  description:
    'Crea un obiettivo, cioè un risultato da raggiungere entro un orizzonte temporale. ' +
    'Sta sopra progetti e task. Usalo per traguardi ("mettere da parte 10.000 euro entro l\'anno"), ' +
    'non per cose da fare.',
  parameters: z.object({
    title: z.string().describe("Cosa vuole raggiungere, con le parole della persona."),
    horizon: z
      .enum(GOAL_HORIZONS)
      .describe(
        "Orizzonte: 'yearly' annuale, 'quarterly' trimestrale, 'monthly' mensile, 'weekly' settimanale.",
      ),
    currentValue: z
      .string()
      .nullish()
      .describe(
        'Il valore da cui parte adesso, se è un obiettivo numerico. Formato italiano accettato. ' +
          "Ometti per obiettivi senza numeri come 'leggere di più'.",
      ),
    targetValue: z.string().nullish().describe('Il valore da raggiungere, se è un obiettivo numerico.'),
    unit: z.string().nullish().describe("Unità di misura: 'EUR', 'kg', 'libri'."),
    deadline: z.string().nullish().describe(`Entro quando. ${ABSOLUTE_DATE}`),
  }),
  async execute(ctx, args) {
    const goal = await createGoal(ctx.db, ctx.userId, {
      title: args.title,
      horizon: args.horizon,
      // Where a goal starts is where the person is now, so progress reads 0
      // rather than crediting what was already there.
      startValue: args.currentValue,
      currentValue: args.currentValue,
      targetValue: args.targetValue,
      metricUnit: args.unit,
      deadline: args.deadline,
    })

    const target =
      goal.target_value !== null
        ? ` da ${Number(goal.start_value)} a ${Number(goal.target_value)}${goal.metric_unit ? ` ${goal.metric_unit}` : ''}`
        : ''

    return {
      summary: `Creato l'obiettivo ${GOAL_HORIZON_LABELS[goal.horizon].toLowerCase()} «${goal.title}»${target}.`,
      data: { id: goal.id, title: goal.title },
    }
  },
})

export const updateGoalProgressTool = defineTool({
  name: 'update_goal_progress',
  description:
    "Aggiorna il valore attuale di un obiettivo numerico, individuandolo dal titolo. Usalo quando " +
    'la persona dice a che punto è ("sono arrivato a 8.000 dei 10.000").',
  parameters: z.object({
    title: z.string().describe("Titolo, anche parziale, dell'obiettivo."),
    currentValue: z.string().describe('Il valore raggiunto adesso. Formato italiano accettato.'),
  }),
  async execute(ctx, args) {
    const goals = await listGoals(ctx.db, ctx.userId)
    const match = requireMatch(
      goals.map((g) => ({ id: g.id, name: g.title })),
      args.title,
      "l'obiettivo",
    )

    const goal = await updateGoal(ctx.db, ctx.userId, match.id, {
      currentValue: args.currentValue,
    })

    const unit = goal.metric_unit ? ` ${goal.metric_unit}` : ''
    const progress = goal.progress !== null ? ` — ${goal.progress}% del percorso` : ''

    return {
      summary: `«${goal.title}» aggiornato a ${Number(goal.current_value)}${unit}${progress}.`,
      data: { id: goal.id, progress: goal.progress },
    }
  },
})

export const listGoalsTool = defineTool({
  name: 'list_goals',
  description:
    'Elenca gli obiettivi in corso con il loro avanzamento. Usalo per domande su come stanno ' +
    'andando gli obiettivi o quali sono fermi.',
  parameters: z.object({}),
  async execute(ctx) {
    const goals = await listGoals(ctx.db, ctx.userId)

    if (goals.length === 0) return { summary: 'Non ci sono obiettivi attivi.', data: [] }

    return {
      summary: `${goals.length} obiettivi attivi.`,
      data: goals.map((g) => ({
        titolo: g.title,
        orizzonte: GOAL_HORIZON_LABELS[g.horizon],
        attuale: Number(g.current_value),
        traguardo: g.target_value === null ? null : Number(g.target_value),
        unità: g.metric_unit,
        avanzamento: g.progress === null ? null : `${g.progress}%`,
        scadenza: g.deadline,
      })),
    }
  },
})

// --- Inbox -------------------------------------------------------------------

export const captureNoteTool = defineTool({
  name: 'capture_note',
  description:
    "Salva in inbox un pensiero, un'idea o un appunto che non richiede un'azione immediata " +
    '("mi è venuta un\'idea per un SaaS"). Usalo anche quando non capisci che tipo di informazione ' +
    'sia: meglio conservarla da smistare che perderla.',
  parameters: z.object({
    text: z.string().describe("Il testo così come lo ha detto la persona, senza riassumerlo."),
  }),
  async execute(ctx, args) {
    const item = await captureInboxItem(
      ctx.db,
      ctx.userId,
      { rawText: args.text },
      ctx.channel === 'telegram' ? 'telegram' : 'ai',
    )

    return { summary: 'Salvato in inbox, lo smisterai quando vuoi.', data: { id: item.id } }
  },
})

export const listInboxTool = defineTool({
  name: 'list_inbox',
  description: 'Elenca gli appunti ancora da smistare in inbox.',
  parameters: z.object({}),
  async execute(ctx) {
    const items = await listInboxItems(ctx.db, ctx.userId)

    if (items.length === 0) return { summary: "L'inbox è vuota.", data: [] }

    return {
      summary: `${items.length} appunti da smistare.`,
      data: items.map((item) => ({ testo: item.raw_text, quando: item.created_at })),
    }
  },
})

// --- Overview ----------------------------------------------------------------

export const getTodayTool = defineTool({
  name: 'get_today',
  description:
    'Restituisce il quadro della giornata: impegni e scadenze di oggi, task arretrati, ' +
    'saldo e situazione del mese. Usalo per domande generiche come "come sto messo oggi" ' +
    'o quando serve un riepilogo prima di rispondere.',
  parameters: z.object({}),
  async execute(ctx) {
    const today = todayISO(ctx.timezone)
    const endOfToday = endOfDayInTimeZone(today, ctx.timezone).toISOString()

    const [dueToday, allOpen, accounts, summary, inbox] = await Promise.all([
      listTasks(ctx.db, ctx.userId, { dueBefore: endOfToday }),
      listTasks(ctx.db, ctx.userId),
      listAccounts(ctx.db, ctx.userId),
      getFinancialSummary(ctx.db, ctx.userId, monthRange(ctx.now, ctx.timezone)),
      listInboxItems(ctx.db, ctx.userId),
    ])

    const balance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0)
    const overdue = dueToday.filter((t) => t.due_at && t.due_at < ctx.now.toISOString())

    return {
      summary:
        `Oggi ${dueToday.length} cose in scadenza (${overdue.length} già scadute), ` +
        `${allOpen.length} task aperti in tutto. Saldo ${formatEUR(balance)}, ` +
        `uscite del mese ${formatEUR(summary.expense)}. ${inbox.length} appunti in inbox.`,
      data: {
        oggi: dueToday.map((t) => ({
          titolo: t.title,
          quando: t.due_at ? `${formatRelativeDay(t.due_at)} ${formatTime(t.due_at)}` : null,
          scaduto: Boolean(t.due_at && t.due_at < ctx.now.toISOString()),
        })),
        taskApertiTotali: allOpen.length,
        saldo: balance,
        entrateMese: summary.income,
        usciteMese: summary.expense,
        appuntiInInbox: inbox.length,
      },
    }
  },
})

const KIND_LABELS: Partial<Record<Enums['entity_type'], string>> = {
  task: 'task',
  project: 'progetto',
  goal: 'obiettivo',
  event: 'appuntamento',
  transaction: 'movimento',
  person: 'persona',
  inbox_item: 'appunto in inbox',
}

export const searchGlobalTool = defineTool({
  name: 'search_global',
  description:
    'Cerca per parola in tutto quello che la persona ha registrato: task, progetti, obiettivi, ' +
    'appuntamenti, movimenti, persone, appunti. Usalo quando si riferisce a qualcosa che ha già ' +
    'nominato prima ("quel progetto del commercialista", "quanto ho speso da Marco") e non sai ' +
    'a cosa corrisponde. Non inventare: se qui non esce nulla, quella cosa non c\'è.',
  parameters: z.object({
    query: z
      .string()
      .describe('Una o due parole chiave, non una frase intera: la ricerca è testuale.'),
  }),
  async execute(ctx, args) {
    const hits = await searchEverything(ctx.db, ctx.userId, args.query, 10)

    if (hits.length === 0) {
      return {
        summary: `Non ho trovato niente che contenga «${args.query}».`,
        data: { risultati: [] },
      }
    }

    return {
      summary: hits
        .map((hit) => `${hit.title} (${KIND_LABELS[hit.entityType] ?? hit.entityType})`)
        .join(' · '),
      data: {
        risultati: hits.map((hit) => ({
          tipo: hit.entityType,
          id: hit.id,
          titolo: hit.title,
        })),
      },
    }
  },
})
