import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const [, , action, arg] = process.argv
if (action === 'create') {
  const email = `ui-check-${Date.now()}@example.test`
  const password = 'UiCheck!2026abc'
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  console.log(JSON.stringify({ id: data.user.id, email, password }))
} else {
  const { error } = await admin.auth.admin.deleteUser(arg)
  if (error) throw error
  console.log('eliminato', arg)
}
