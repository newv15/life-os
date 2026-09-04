import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * The database handle every repository takes.
 *
 * It is passed in rather than imported, because the same repository has to
 * serve two callers with different identities: a web request, whose client
 * carries the user's session and is bounded by RLS, and the Telegram webhook
 * or cron tick, whose client uses the service role and is not bounded by
 * anything. Injecting the client is what lets one implementation serve both -
 * and it is why every repository function takes `userId` explicitly and filters
 * on it, instead of trusting the connection to do it.
 */
export type Db = SupabaseClient<Database>

type PublicSchema = Database['public']

export type Tables = PublicSchema['Tables']
export type Row<T extends keyof Tables> = Tables[T]['Row']
export type Insert<T extends keyof Tables> = Tables[T]['Insert']
export type Update<T extends keyof Tables> = Tables[T]['Update']
export type Enums = PublicSchema['Enums']

/** Insert values with the owner removed: the server supplies it, never the caller. */
export type OwnedInsert<T extends keyof Tables> = Omit<Insert<T>, 'user_id'>
