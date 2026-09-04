import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Server client bound to the request's session. Still uses the anon key, so RLS
 * applies: this is the client every web page and Server Action should use.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    publicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Components cannot set cookies. The proxy refreshes the
            // session on every request, so this is safe to ignore here.
          }
        },
      },
    },
  )
}

/**
 * The authenticated user id, or null.
 *
 * Uses getUser() rather than getSession(): getSession() trusts the cookie as
 * sent, getUser() revalidates it with the auth server.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** Same, but for code paths where being unauthenticated is a bug. */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Non autenticato')
  return userId
}
