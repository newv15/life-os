import { describe, expect, it } from 'vitest'
import { adminClient, createTestUser, supabaseConfigured, type Db } from '../helpers/supabase'
import { createTransaction, listAccounts } from '@/lib/services/finance'
import { createTask } from '@/lib/services/tasks'

/**
 * Deleting an account must actually delete it.
 *
 * This is not only housekeeping. "Get your data out and then remove it" is a
 * promise the system makes, and a delete that fails halfway leaves rows behind
 * with no owner and no way to reach them.
 *
 * The case that broke it: transactions reference accounts with ON DELETE
 * RESTRICT - the right rule, because deleting a bank account should never
 * silently erase its history. But removing a user cascades into accounts, and
 * that restriction blocked the cascade, so any user who had ever recorded a
 * movement could not be deleted at all.
 */

describe.skipIf(!supabaseConfigured)('deleting a user', () => {
  const admin: Db = adminClient()

  it('removes a user who has recorded movements, and everything they owned', async () => {
    const user = await createTestUser(admin, 'deletion')
    const accounts = await listAccounts(admin, user.id)

    await createTransaction(admin, user.id, {
      type: 'expense',
      accountId: accounts[0].id,
      amount: '35',
      description: 'Spesa da cancellare',
    })
    await createTransaction(admin, user.id, {
      type: 'transfer',
      accountId: accounts[0].id,
      transferAccountId: accounts[1].id,
      amount: '10',
    })
    await createTask(admin, user.id, { title: 'Task da cancellare' })

    const { error } = await admin.auth.admin.deleteUser(user.id)
    expect(error).toBeNull()

    for (const table of ['transactions', 'accounts', 'categories', 'tasks', 'profiles'] as const) {
      const { count } = await admin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      expect(count, `${table} avrebbe dovuto essere vuota`).toBe(0)
    }
  }, 60_000)

  it('still refuses to delete an account that has movements', async () => {
    // The protection that caused the problem is worth keeping: losing a
    // ledger because someone tidied up an account would be far worse.
    const user = await createTestUser(admin, 'deletion-guard')
    try {
      const accounts = await listAccounts(admin, user.id)
      await createTransaction(admin, user.id, {
        type: 'expense',
        accountId: accounts[0].id,
        amount: '20',
      })

      const { error } = await admin.from('accounts').delete().eq('id', accounts[0].id)

      expect(error).not.toBeNull()
      expect(error?.code).toBe('23503')
    } finally {
      await admin.auth.admin.deleteUser(user.id)
    }
  }, 60_000)
})
