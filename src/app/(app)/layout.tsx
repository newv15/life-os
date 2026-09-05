import { redirect } from 'next/navigation'
import { CommandBar } from '@/components/ai/command-bar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Sidebar } from '@/components/layout/sidebar'
import { getCurrentUserId } from '@/lib/db/server'
import { isAIConfigured } from '@/lib/env'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  // The proxy already redirects unauthenticated requests. This is the
  // second check, next to the data: security must not depend on routing.
  const userId = await getCurrentUserId()
  if (!userId) redirect('/login')

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-5 py-6 md:px-10 md:py-9">
          <div className="mx-auto w-full max-w-4xl">
            {/* Shown only once there is a model to talk to. An input that
                always fails is worse than no input. */}
            {isAIConfigured() ? <CommandBar /> : null}
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
