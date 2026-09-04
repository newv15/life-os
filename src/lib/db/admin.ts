import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { publicEnv, serverEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * THE ONLY PLACE IN THE CODEBASE THAT HOLDS THE SERVICE ROLE KEY.
 *
 * This client BYPASSES Row Level Security. It exists because the Telegram
 * webhook and the cron tick have no browser session to attach to - they resolve
 * the user themselves (from telegram_accounts, or from the row being processed)
 * before touching any data.
 *
 * Consequences, and how they are contained:
 *
 *  1. `import 'server-only'` makes importing this from a client component a
 *     build error, not a runtime surprise.
 *  2. Nothing outside `lib/db/repositories` may call this directly. Repository
 *     functions take `userId` as a required first argument and always filter on
 *     it, so a query without an owner filter cannot be written by accident.
 *  3. The composite foreign keys in the schema mean the database itself refuses
 *     to link records across users even here.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}
