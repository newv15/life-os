import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/layout/page-header'
import { HabitComposer } from '@/components/habits/habit-composer'
import { HabitList } from '@/components/habits/habit-list'
import { createServerSupabase, requireUserId } from '@/lib/db/server'
import { listHabits } from '@/lib/services/habits'

export const metadata: Metadata = { title: 'Abitudini · Life OS' }

export default async function HabitsPage() {
  const db = await createServerSupabase()
  const userId = await requireUserId()

  const habits = await listHabits(db, userId)
  const dueToday = habits.filter((habit) => habit.dueToday && !habit.doneToday)

  return (
    <>
      <PageHeader
        eyebrow={
          habits.length === 0
            ? 'Costanza'
            : dueToday.length === 0
              ? 'Tutto fatto per oggi'
              : `${dueToday.length} da fare oggi`
        }
        title="Abitudini"
      />

      <HabitComposer />

      {habits.length === 0 ? (
        <EmptyState
          title="Nessuna abitudine da tenere."
          hint="Le abitudini sono le cose che vuoi ripetere, non quelle da fare una volta. La serie conta i giorni di fila; i giorni in cui non tocca non la interrompono."
        />
      ) : (
        <HabitList habits={habits} />
      )}
    </>
  )
}
