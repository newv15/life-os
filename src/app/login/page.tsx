import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Entra · Life OS',
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const redirectTo = typeof params.redirect === 'string' ? params.redirect : undefined

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* The same vertical rule the dashboard hangs the day on, used here at
            its quietest: one line, one mark, nothing else. */}
        <div className="mb-10 border-l-2 border-primary pl-5">
          <h1 className="font-heading text-3xl leading-none">Life OS</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Il tuo sistema personale.
          </p>
        </div>

        <LoginForm redirectTo={redirectTo} />

        <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
          Sistema a utente singolo: la registrazione è chiusa. Se hai perso la
          password, reimpostala dal pannello Supabase del progetto.
        </p>
      </div>
    </main>
  )
}
