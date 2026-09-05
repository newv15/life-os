import { z } from 'zod'
import { defineTool } from '@/lib/ai/tools/types'
import { ABSOLUTE_DATE, ABSOLUTE_DATETIME, optionalMatch, requireMatch } from '@/lib/ai/tools/shared'
import { formatRelativeDay, formatTime, daysAgo, todayISO } from '@/lib/utils/date'
import { formatDuration } from '@/lib/utils/duration'
import { WEEKDAY_LABELS } from '@/lib/validation/enums'
import { createEvent, listEvents } from '@/lib/services/calendar'
import { createHabit, listHabits, recordHabit } from '@/lib/services/habits'
import {
  createPerson,
  getRunningTimer,
  listPeople,
  saveJournalEntry,
  startTimer,
  stopTimer,
  timeSummary,
  updatePerson,
} from '@/lib/services/personal'
import { listProjects } from '@/lib/services/projects'
import { ConflictError } from '@/lib/services/errors'

// --- Calendar ----------------------------------------------------------------

export const createEventTool = defineTool({
  name: 'create_event',
  description:
    'Crea un appuntamento o un impegno a un orario preciso: una riunione, una visita, una cena. ' +
    'Usalo quando la persona parla di qualcosa che avviene a un certo momento, non di qualcosa ' +
    'che deve fare entro una scadenza (per quello usa create_task).',
  parameters: z.object({
    title: z.string().describe("Di cosa si tratta, in forma breve."),
    startsAt: z.string().describe(`Quando comincia. ${ABSOLUTE_DATETIME}`),
    endsAt: z.string().nullish().describe(`Quando finisce, se la persona lo ha detto. ${ABSOLUTE_DATETIME}`),
    location: z.string().nullish().describe('Dove, se indicato.'),
  }),
  async execute(ctx, args) {
    const event = await createEvent(
      ctx.db,
      ctx.userId,
      {
        title: args.title,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        location: args.location,
      },
      ctx.channel === 'telegram' ? 'telegram' : 'ai',
    )

    return {
      summary:
        `Segnato «${event.title}» ${formatRelativeDay(event.starts_at)} alle ${formatTime(event.starts_at)}` +
        `${event.location ? ` — ${event.location}` : ''}.`,
      data: { id: event.id },
    }
  },
})

export const getAgendaTool = defineTool({
  name: 'get_agenda',
  description:
    'Elenca gli appuntamenti in programma. Usalo per domande su cosa c\'è in agenda, ' +
    'che impegni ci sono domani o nei prossimi giorni.',
  parameters: z.object({
    from: z.string().nullish().describe(`Da quale giorno. ${ABSOLUTE_DATE} Se ometti parte da oggi.`),
    days: z
      .number()
      .int()
      .min(1)
      .max(60)
      .nullish()
      .describe('Quanti giorni guardare avanti. Se omesso, sette.'),
  }),
  async execute(ctx, args) {
    const from = args.from ? new Date(`${args.from}T00:00:00`) : ctx.now
    const days = args.days ?? 7
    const until = new Date(from.getTime() + days * 86_400_000)

    const events = await listEvents(ctx.db, ctx.userId, {
      from: from.toISOString(),
      before: until.toISOString(),
      limit: 50,
    })

    if (events.length === 0) {
      return { summary: 'Non c\'è nulla in agenda nel periodo richiesto.', data: [] }
    }

    return {
      summary: `${events.length} impegni in agenda.`,
      data: events.map((event) => ({
        titolo: event.title,
        quando: `${formatRelativeDay(event.starts_at)} ${formatTime(event.starts_at)}`,
        dove: event.location,
      })),
    }
  },
})

// --- Habits ------------------------------------------------------------------

export const createHabitTool = defineTool({
  name: 'create_habit',
  description:
    "Crea un'abitudine, cioè qualcosa da ripetere regolarmente ('voglio andare in palestra il " +
    "lunedì e il giovedì'). Non usarlo per cose da fare una volta sola: quelle sono task.",
  parameters: z.object({
    name: z.string().describe("Nome dell'abitudine, breve."),
    frequency: z
      .enum(['daily', 'weekly'])
      .nullish()
      .describe("'daily' se tutti i giorni, 'weekly' se solo in certi giorni. Se omesso, daily."),
    daysOfWeek: z
      .array(z.number().int().min(1).max(7))
      .nullish()
      .describe(
        "Giorni della settimana, con 1 = lunedì e 7 = domenica. Obbligatorio se frequency è 'weekly'.",
      ),
  }),
  async execute(ctx, args) {
    const frequency = args.frequency ?? 'daily'

    const habit = await createHabit(
      ctx.db,
      ctx.userId,
      {
        name: args.name,
        frequency,
        daysOfWeek: frequency === 'weekly' ? (args.daysOfWeek ?? []) : [],
      },
      ctx.channel === 'telegram' ? 'telegram' : 'ai',
    )

    const days =
      habit.frequency === 'weekly'
        ? ` il ${(habit.days_of_week ?? []).map((d) => WEEKDAY_LABELS[d]).join(', ')}`
        : ' tutti i giorni'

    return { summary: `Creata l'abitudine «${habit.name}»${days}.`, data: { id: habit.id } }
  },
})

export const completeHabitTool = defineTool({
  name: 'complete_habit',
  description:
    "Segna un'abitudine come fatta, individuandola dal nome. Usalo quando la persona dice di " +
    "averla fatta ('sono andato in palestra', 'fatto').",
  parameters: z.object({
    name: z.string().describe("Nome, anche parziale, dell'abitudine."),
    date: z.string().nullish().describe(`Il giorno a cui riferirla. ${ABSOLUTE_DATE} Ometti se oggi.`),
  }),
  async execute(ctx, args) {
    const habits = await listHabits(ctx.db, ctx.userId, ctx.timezone)
    const match = requireMatch(habits, args.name, "l'abitudine")

    await recordHabit(ctx.db, ctx.userId, match.id, {
      date: args.date ?? undefined,
      timezone: ctx.timezone,
    })

    const updated = (await listHabits(ctx.db, ctx.userId, ctx.timezone)).find(
      (habit) => habit.id === match.id,
    )!

    return {
      summary: `Segnata «${updated.name}». Serie: ${updated.streak} ${updated.streak === 1 ? 'giorno' : 'giorni'} di fila.`,
      data: { id: updated.id, streak: updated.streak },
    }
  },
})

export const listHabitsTool = defineTool({
  name: 'list_habits',
  description:
    "Elenca le abitudini con la serie in corso e quante ne restano da fare oggi. Usalo per " +
    'domande su come stanno andando le abitudini.',
  parameters: z.object({}),
  async execute(ctx) {
    const habits = await listHabits(ctx.db, ctx.userId, ctx.timezone)

    if (habits.length === 0) return { summary: 'Nessuna abitudine attiva.', data: [] }

    const daFare = habits.filter((habit) => habit.dueToday && !habit.doneToday)

    return {
      summary: `${habits.length} abitudini, ${daFare.length} ancora da fare oggi.`,
      data: habits.map((habit) => ({
        nome: habit.name,
        serie: habit.streak,
        fattaOggi: habit.doneToday,
        toccaOggi: habit.dueToday,
        costanza30giorni: `${habit.consistency}%`,
      })),
    }
  },
})

// --- Journal -----------------------------------------------------------------

export const writeJournalTool = defineTool({
  name: 'write_journal',
  description:
    "Scrive nel diario della giornata. Usalo quando la persona racconta com'è andata o come si " +
    "sente ('oggi è stata una giornata produttiva', 'sono stanco morto'). Riscrivere lo stesso " +
    'giorno aggiorna quanto già scritto.',
  parameters: z.object({
    body: z.string().describe("Il racconto della giornata, con le parole della persona."),
    date: z.string().nullish().describe(`A che giorno si riferisce. ${ABSOLUTE_DATE} Ometti se oggi.`),
    energy: z
      .number()
      .int()
      .min(1)
      .max(5)
      .nullish()
      .describe("Livello di energia da 1 a 5, solo se la persona lo ha espresso. Non dedurlo."),
    mood: z
      .number()
      .int()
      .min(1)
      .max(5)
      .nullish()
      .describe("Umore da 1 a 5, solo se la persona lo ha espresso. Non dedurlo."),
  }),
  async execute(ctx, args) {
    const entry = await saveJournalEntry(
      ctx.db,
      ctx.userId,
      {
        entryDate: args.date ?? todayISO(ctx.timezone),
        body: args.body,
        energy: args.energy,
        mood: args.mood,
      },
      ctx.channel === 'telegram' ? 'telegram' : 'ai',
    )

    return {
      summary: `Scritto nel diario di ${formatRelativeDay(`${entry.entry_date}T12:00:00`)}.`,
      data: { date: entry.entry_date },
    }
  },
})

// --- People ------------------------------------------------------------------

export const createPersonTool = defineTool({
  name: 'create_person',
  description:
    'Aggiunge una persona alla rubrica personale. Usalo quando viene nominato qualcuno di nuovo ' +
    "che vale la pena ricordare ('Marco è il mio nuovo commercialista').",
  parameters: z.object({
    fullName: z.string().describe('Nome della persona.'),
    relationship: z.string().nullish().describe("Chi è: 'commercialista', 'cliente', 'fratello'."),
    company: z.string().nullish().describe('Azienda o studio, se detto.'),
    phone: z.string().nullish().describe('Numero di telefono, se detto.'),
    notes: z.string().nullish().describe('Qualsiasi altro dettaglio utile.'),
  }),
  async execute(ctx, args) {
    const person = await createPerson(
      ctx.db,
      ctx.userId,
      {
        fullName: args.fullName,
        relationship: args.relationship,
        company: args.company,
        phone: args.phone,
        notes: args.notes,
      },
      ctx.channel === 'telegram' ? 'telegram' : 'ai',
    )

    return {
      summary: `Aggiunto ${person.full_name}${person.relationship ? ` (${person.relationship})` : ''} alla rubrica.`,
      data: { id: person.id },
    }
  },
})

export const setPersonNextActionTool = defineTool({
  name: 'set_person_next_action',
  description:
    "Registra cosa devi fare con una persona e quando ('devo mandare i documenti a Marco entro " +
    "venerdì'). Individua la persona dal nome.",
  parameters: z.object({
    name: z.string().describe('Nome, anche parziale, della persona.'),
    action: z.string().describe('Cosa va fatto con questa persona.'),
    when: z.string().nullish().describe(`Entro quando. ${ABSOLUTE_DATETIME}`),
  }),
  async execute(ctx, args) {
    const people = await listPeople(ctx.db, ctx.userId)
    const match = requireMatch(
      people.map((person) => ({ id: person.id, name: person.full_name })),
      args.name,
      'la persona',
    )

    const updated = await updatePerson(ctx.db, ctx.userId, match.id, {
      nextAction: args.action,
      nextActionAt: args.when,
    })

    const when = updated.next_action_at
      ? ` entro ${formatRelativeDay(updated.next_action_at)}`
      : ''

    return {
      summary: `Con ${updated.full_name}: ${updated.next_action}${when}.`,
      data: { id: updated.id },
    }
  },
})

export const listPeopleTool = defineTool({
  name: 'list_people',
  description:
    'Elenca le persone in rubrica con le cose in sospeso con ciascuna. Usalo per domande su chi ' +
    'devi sentire o cosa devi a qualcuno.',
  parameters: z.object({}),
  async execute(ctx) {
    const people = await listPeople(ctx.db, ctx.userId)

    if (people.length === 0) return { summary: 'La rubrica è vuota.', data: [] }

    return {
      summary: `${people.length} persone in rubrica.`,
      data: people.map((person) => ({
        nome: person.full_name,
        chiE: person.relationship,
        daFare: person.next_action,
        entro: person.next_action_at,
      })),
    }
  },
})

// --- Time tracking -----------------------------------------------------------

export const startTimerTool = defineTool({
  name: 'start_timer',
  description:
    "Avvia il cronometro su un'attività. Usalo quando la persona dice di stare cominciando a " +
    "lavorare su qualcosa ('inizio a lavorare sul progetto Yume'). Se un cronometro è già in " +
    'corso viene fermato automaticamente.',
  parameters: z.object({
    note: z.string().nullish().describe('Su cosa sta lavorando, con le sue parole.'),
    projectName: z.string().nullish().describe('Progetto a cui imputare il tempo, se nominato.'),
  }),
  async execute(ctx, args) {
    const projects = await listProjects(ctx.db, ctx.userId)
    const project = optionalMatch(projects, args.projectName, 'il progetto')

    const { started, stopped } = await startTimer(
      ctx.db,
      ctx.userId,
      { note: args.note, projectId: project?.id },
      ctx.channel === 'telegram' ? 'telegram' : 'ai',
    )

    const closed = stopped
      ? ` Ho fermato il precedente (${formatDuration((new Date(stopped.ended_at!).getTime() - new Date(stopped.started_at).getTime()) / 1000)}).`
      : ''

    return {
      summary: `Cronometro avviato${args.note ? ` su «${args.note}»` : ''}${project ? ` — ${project.name}` : ''}.${closed}`,
      data: { id: started.id },
    }
  },
})

export const stopTimerTool = defineTool({
  name: 'stop_timer',
  description:
    "Ferma il cronometro in corso. Usalo quando la persona dice di avere finito ('ho finito', " +
    "'stop').",
  parameters: z.object({}),
  async execute(ctx) {
    const running = await getRunningTimer(ctx.db, ctx.userId)
    if (!running) throw new ConflictError('Non c\'è nessun cronometro in corso.')

    const stopped = await stopTimer(ctx.db, ctx.userId)
    const seconds =
      (new Date(stopped.ended_at!).getTime() - new Date(stopped.started_at).getTime()) / 1000

    return {
      summary: `Fermato dopo ${formatDuration(seconds)}${stopped.note ? ` su «${stopped.note}»` : ''}.`,
      data: { seconds },
    }
  },
})

export const getTimeSummaryTool = defineTool({
  name: 'get_time_summary',
  description:
    'Riepiloga quanto tempo è stato tracciato in un periodo, ripartito per progetto. Usalo per ' +
    'domande su quanto si è lavorato o su cosa se ne va il tempo.',
  parameters: z.object({
    days: z
      .number()
      .int()
      .min(1)
      .max(90)
      .nullish()
      .describe('Quanti giorni indietro guardare. Se omesso, sette.'),
  }),
  async execute(ctx, args) {
    const days = args.days ?? 7
    const summary = await timeSummary(ctx.db, ctx.userId, daysAgo(days, ctx.now).toISOString())
    const projects = await listProjects(ctx.db, ctx.userId, 'all')
    const projectName = new Map(projects.map((project) => [project.id, project.name]))

    return {
      summary: `Negli ultimi ${days} giorni: ${formatDuration(summary.totalSeconds)} tracciati.`,
      data: {
        totale: formatDuration(summary.totalSeconds),
        perProgetto: summary.byProject.map((row) => ({
          progetto: row.projectId ? projectName.get(row.projectId) : 'Senza progetto',
          tempo: formatDuration(row.seconds),
        })),
      },
    }
  },
})
