import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import type { Database } from '@/types/database'

config({ path: '.env.local', quiet: true })

/**
 * Test plumbing for the integration suite.
 *
 * These tests run against the real project rather than a mock, because the
 * things worth testing here - RLS, composite foreign keys, the balance trigger,
 * the check constraint that keeps status and completed_at in step - only exist
 * in Postgres. A mock would test our idea of the database, not the database.
 *
 * Every test user is thrown away afterwards, so the real account stays clean.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/** False when .env.local is absent, so `npm test` still runs offline. */
export const supabaseConfigured = Boolean(url && anonKey && serviceKey)

export type Db = SupabaseClient<Database>

export function adminClient(): Db {
  return createClient<Database>(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type TestUser = { id: string; email: string; password: string }

export async function createTestUser(admin: Db, label: string): Promise<TestUser> {
  const stamp = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const user: TestUser = {
    id: '',
    email: `${stamp}@example.test`,
    password: `Pw-${stamp}!1`,
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  })
  if (error) throw error

  user.id = data.user.id
  return user
}

/** Deleting the auth user cascades to every row they own. */
export async function deleteTestUser(admin: Db, userId: string): Promise<void> {
  if (userId) await admin.auth.admin.deleteUser(userId)
}

/** A client carrying a real session, for the code paths RLS actually guards. */
export async function signedInClient(user: TestUser): Promise<Db> {
  const client = createClient<Database>(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })
  if (error) throw error
  return client
}
