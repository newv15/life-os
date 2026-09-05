'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { runAction, type ActionResult } from '@/lib/actions/result'
import { createProject, deleteProject, updateProject } from '@/lib/services/projects'

function refresh() {
  revalidatePath('/projects')
  revalidatePath('/tasks')
  revalidatePath('/')
}

export async function createProjectAction(
  _prev: ActionResult<string> | null,
  formData: FormData,
): Promise<ActionResult<string>> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await createProject(db, userId, {
      name: formData.get('name'),
      goalId: formData.get('goalId'),
      deadline: formData.get('deadline'),
      priority: formData.get('priority') || undefined,
    })

    refresh()
    return crypto.randomUUID()
  })
}

export async function updateProjectAction(
  id: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await updateProject(db, userId, id, patch)

    refresh()
    return undefined
  })
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const db = await createServerSupabase()
    const userId = await requireUserId()

    await deleteProject(db, userId, id)

    refresh()
    return undefined
  })
}
