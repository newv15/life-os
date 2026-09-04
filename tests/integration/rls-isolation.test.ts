import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

config({ path: '.env.local', quiet: true })

/**
 * Row Level Security, tested against the real database.
 *
 * The whole security model rests on one claim: a signed-in session can only
 * ever see its own rows. That claim is worth nothing until something proves it
 * on every table, so this creates two throwaway users, gives one of them data,
 * and checks the other cannot reach it - by reading, by writing, or by
 * smuggling a foreign key across the boundary.
 *
 * Skipped automatically when .env.local is absent, so `npm test` still runs
 * offline.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const configured = Boolean(url && anonKey && serviceKey)

/** Every table a signed-in session could try to read another user's rows from. */
const OWNED_TABLES = [
  'profiles',
  'telegram_accounts',
  'categories',
  'tags',
  'taggables',
  'entity_links',
  'people',
  'goals',
  'goal_milestones',
  'projects',
  'tasks',
  'events',
  'accounts',
  'transactions',
  'budgets',
  'habits',
  'habit_entries',
  'journal_entries',
  'notes',
  'inbox_items',
  'time_entries',
  'memories',
  'ai_conversations',
  'ai_messages',
  'ai_action_logs',
  'pending_confirmations',
  'notifications',
  'automation_rules',
] as const

describe.skipIf(!configured)('RLS isolation', () => {
  const admin = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const suffix = Date.now()
  const users = {
    a: { email: `rls-a-${suffix}@example.test`, password: `pw-a-${suffix}!Aa1`, id: '' },
    b: { email: `rls-b-${suffix}@example.test`, password: `pw-b-${suffix}!Bb1`, id: '' },
  }

  let sessionA: SupabaseClient
  let projectB = ''
  let taskB = ''

  beforeAll(async () => {
    for (const key of ['a', 'b'] as const) {
      const { data, error } = await admin.auth.admin.createUser({
        email: users[key].email,
        password: users[key].password,
        email_confirm: true,
      })
      if (error) throw error
      users[key].id = data.user.id
    }

    // B's data, written with the service role - the same path Telegram uses.
    const { data: project, error: projectError } = await admin
      .from('projects')
      .insert({ user_id: users.b.id, name: `Progetto di B ${suffix}` })
      .select('id')
      .single()
    if (projectError) throw projectError
    projectB = project.id

    const { data: task, error: taskError } = await admin
      .from('tasks')
      .insert({ user_id: users.b.id, title: 'Task privato di B', project_id: projectB })
      .select('id')
      .single()
    if (taskError) throw taskError
    taskB = task.id

    sessionA = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signInError } = await sessionA.auth.signInWithPassword({
      email: users.a.email,
      password: users.a.password,
    })
    if (signInError) throw signInError
  }, 60_000)

  afterAll(async () => {
    for (const key of ['a', 'b'] as const) {
      if (users[key].id) await admin.auth.admin.deleteUser(users[key].id)
    }
  }, 60_000)

  it('bootstraps a new user so the system is usable immediately', async () => {
    const { data: profile } = await sessionA.from('profiles').select('*').single()
    expect(profile?.timezone).toBe('Europe/Rome')
    expect(profile?.locale).toBe('it')

    const { count: accounts } = await sessionA
      .from('accounts')
      .select('*', { count: 'exact', head: true })
    expect(accounts).toBe(2)

    const { count: categories } = await sessionA
      .from('categories')
      .select('*', { count: 'exact', head: true })
    expect(categories).toBe(27)
  })

  it.each(OWNED_TABLES)('does not leak any row of %s to another user', async (table) => {
    const { data, error } = await sessionA.from(table).select('user_id')
    expect(error).toBeNull()
    expect(data?.some((row) => row.user_id === users.b.id)).toBe(false)
  })

  it("cannot read another user's task even knowing its id", async () => {
    const { data } = await sessionA.from('tasks').select('*').eq('id', taskB)
    expect(data).toEqual([])
  })

  it("cannot write a row owned by another user", async () => {
    const { error } = await sessionA
      .from('tasks')
      .insert({ user_id: users.b.id, title: 'Iniettato da A' })
    expect(error).not.toBeNull()
  })

  it("cannot update another user's task", async () => {
    const { data } = await sessionA
      .from('tasks')
      .update({ title: 'Dirottato da A' })
      .eq('id', taskB)
      .select()
    expect(data).toEqual([])
  })

  it("cannot delete another user's task", async () => {
    const { data } = await sessionA.from('tasks').delete().eq('id', taskB).select()
    expect(data).toEqual([])

    // Confirm from outside RLS that the row really is still there.
    const { data: stillThere } = await admin.from('tasks').select('id').eq('id', taskB)
    expect(stillThere).toHaveLength(1)
  })

  it("cannot attach its own task to another user's project", async () => {
    // This is the composite foreign key doing its job: the row would belong to
    // A, so (project_id, user_id) finds no matching project and Postgres
    // refuses it - regardless of RLS.
    const { error } = await sessionA
      .from('tasks')
      .insert({ user_id: users.a.id, title: 'Task di A su progetto di B', project_id: projectB })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23503') // foreign_key_violation
  })

  it('rejects a cross-user link even under the service role, which bypasses RLS', async () => {
    // The Telegram and cron paths run here. RLS offers no protection at all on
    // this connection, so the database constraint is the only thing left.
    const { error } = await admin
      .from('tasks')
      .insert({ user_id: users.a.id, title: 'Cross-user via service role', project_id: projectB })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23503')
  })
})
