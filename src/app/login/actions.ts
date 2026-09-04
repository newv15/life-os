'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/db/server'

const credentialsSchema = z.object({
  email: z.string().email('Indirizzo email non valido.'),
  password: z.string().min(1, 'Inserisci la password.'),
  redirectTo: z.string().startsWith('/').optional(),
})

export type LoginState = { error: string | null }

export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: formData.get('redirectTo') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Deliberately does not distinguish "unknown email" from "wrong password":
    // that difference tells an attacker which accounts exist.
    return { error: 'Email o password non corretti.' }
  }

  revalidatePath('/', 'layout')
  redirect(parsed.data.redirectTo ?? '/')
}

export async function signOut() {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
