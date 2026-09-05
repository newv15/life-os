import { z } from 'zod'
import { defineTool } from '@/lib/ai/tools/types'
import { ABSOLUTE_DATETIME, requireMatch } from '@/lib/ai/tools/shared'
import { formatDateTime, formatRelativeDay, formatTime } from '@/lib/utils/date'
import { PRIORITIES, PRIORITY_LABELS } from '@/lib/validation/enums'
import { ValidationError } from '@/lib/services/errors'
import {
  completeTask,
  createTask,
  deleteTask,
  listTasks,
  type TaskRow,
} from '@/lib/services/tasks'
import { listProjects } from '@/lib/services/projects'
import type { ToolContext } from '@/lib/ai/tools/types'

/**
 * Finds the task someone meant by naming it.
 *
 * People say "segna fatto preparare il catalogo", not a uuid. Two matches is a
 * question, not a coin toss: completing the wrong task is quiet and annoying
 * to undo.
 */
async function findOpenTaskByTitle(ctx: ToolContext, title: string): Promise<TaskRow> {
  const open = await listTasks(ctx.db, ctx.userId)
  const named = open.map((task) => ({ id: task.id, name: task.title }))

  const match = requireMatch(named, title, 'il task')
  return open.find((task) => task.id === match.id)!
}

function describeTask(task: TaskRow): string {
  const parts = [`«${task.title}»`]
  if (task.due_at) parts.push(`per ${formatRelativeDay(task.due_at)} alle ${formatTime(task.due_at)}`)
  if (task.priority === 'high' || task.priority === 'urgent') {
    parts.push(`priorità ${PRIORITY_LABELS[task.priority].toLowerCase()}`)
  }
  return parts.join(', ')
}

export const createTaskTool = defineTool({
  name: 'create_task',
  description:
    'Crea un nuovo task, cioè qualcosa che la persona deve fare. Usalo quando esprime un impegno ' +
    'o un promemoria operativo ("devo chiamare il commercialista", "ricordami di comprare il regalo"). ' +
    'Non usarlo per appunti o idee senza azione: per quelli usa capture_note.',
  parameters: z.object({
    title: z.string().describe('Cosa deve essere fatto, in forma breve e imperativa.'),
    dueAt: z.string().nullish().describe(`Quando scade. ${ABSOLUTE_DATETIME} Ometti se non c'è.`),
    priority: z
      .enum(PRIORITIES)
      .nullish()
      .describe("Priorità del task. Ometti se la persona non l'ha indicata: il valore normale è media."),
    projectName: z
      .string()
      .nullish()
      .describe('Nome del progetto a cui appartiene, se la persona lo ha nominato.'),
    notes: z.string().nullish().describe('Dettagli aggiuntivi detti dalla persona.'),
  }),
  async execute(ctx, args) {
    const projects = await listProjects(ctx.db, ctx.userId)
    const project = args.projectName
      ? requireMatch(
          projects.map((p) => ({ id: p.id, name: p.name })),
          args.projectName,
          'il progetto',
        )
      : null

    const task = await createTask(
      ctx.db,
      ctx.userId,
      {
        title: args.title,
        description: args.notes,
        dueAt: args.dueAt,
        priority: args.priority ?? undefined,
        projectId: project?.id,
      },
      ctx.channel === 'telegram' ? 'telegram' : 'ai',
    )

    return {
      summary: `Creato il task ${describeTask(task)}${project ? ` nel progetto ${project.name}` : ''}.`,
      data: { id: task.id, title: task.title, dueAt: task.due_at },
    }
  },
})

export const completeTaskTool = defineTool({
  name: 'complete_task',
  description:
    'Segna come completato un task esistente, individuandolo dal titolo. Usalo quando la persona ' +
    'dice di avere finito qualcosa ("ho finito il catalogo", "fatto"). Se il titolo è ambiguo ' +
    'il tool te lo dice: in quel caso chiedi quale intendeva.',
  parameters: z.object({
    title: z.string().describe('Titolo, anche parziale, del task da completare.'),
  }),
  async execute(ctx, args) {
    const task = await findOpenTaskByTitle(ctx, args.title)
    const done = await completeTask(ctx.db, ctx.userId, task.id)

    return {
      summary: `Segnato come fatto ${describeTask(done)}.`,
      data: { id: done.id, completedAt: done.completed_at },
    }
  },
})

export const listTasksTool = defineTool({
  name: 'list_tasks',
  description:
    'Elenca i task aperti della persona. Usalo per rispondere a domande su cosa deve fare, ' +
    'cosa è in scadenza o quali sono le priorità.',
  parameters: z.object({
    scope: z
      .enum(['open', 'today', 'overdue'])
      .nullish()
      .describe(
        "Quali task: 'today' quelli in scadenza entro oggi, 'overdue' quelli già scaduti, " +
          "'open' tutti quelli aperti. Se non indicato usa 'open'.",
      ),
  }),
  async execute(ctx, args) {
    const scope = args.scope ?? 'open'
    const filters =
      scope === 'today'
        ? { dueBefore: new Date(ctx.now.getTime() + 24 * 3600 * 1000).toISOString() }
        : scope === 'overdue'
          ? { dueBefore: ctx.now.toISOString() }
          : {}

    const tasks = await listTasks(ctx.db, ctx.userId, { ...filters, limit: 30 })

    if (tasks.length === 0) {
      return { summary: 'Non ci sono task aperti che rientrano nella richiesta.', data: [] }
    }

    return {
      summary: `${tasks.length} task trovati.`,
      data: tasks.map((task) => ({
        titolo: task.title,
        scadenza: task.due_at ? formatDateTime(task.due_at) : null,
        priorità: PRIORITY_LABELS[task.priority],
        stato: task.status,
      })),
    }
  },
})

export const deleteTaskTool = defineTool({
  name: 'delete_task',
  description:
    'Elimina definitivamente un task, individuandolo dal titolo. Usalo solo se la persona chiede ' +
    'esplicitamente di cancellarlo. Se vuole solo segnarlo fatto, usa complete_task.',
  parameters: z.object({
    title: z.string().describe('Titolo, anche parziale, del task da eliminare.'),
  }),
  confirm: (args) => `Elimino definitivamente il task «${args.title}»?`,
  async execute(ctx, args) {
    const task = await findOpenTaskByTitle(ctx, args.title)
    await deleteTask(ctx.db, ctx.userId, task.id)

    return { summary: `Eliminato il task «${task.title}».`, data: { id: task.id } }
  },
})

/** Raised by the helpers above; re-exported so the registry can be tested. */
export { ValidationError }
