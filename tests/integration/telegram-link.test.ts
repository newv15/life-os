import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  supabaseConfigured,
  type Db,
  type TestUser,
} from '../helpers/supabase'
import {
  createLinkCode,
  redeemLinkCode,
  resolveTelegramUser,
  revokeTelegramLink,
} from '@/lib/services/telegram-link'
import { ConflictError, NotFoundError } from '@/lib/services/errors'

/**
 * Linking a Telegram account to this one.
 *
 * This is the whole authentication story of the bot. Telegram hands us a
 * numeric user id and a display name; only the id is trustworthy, since a name
 * and a @username can be changed by anyone at any time. So the link is made
 * once, deliberately, by someone who is already signed in to the web app, and
 * everything afterwards is a lookup of that id.
 */

let counter = 0
const nextTelegramId = () => 900_000_000 + Date.now() % 1_000_000 + counter++

describe.skipIf(!supabaseConfigured)('telegram linking', () => {
  const admin: Db = adminClient()
  let user: TestUser

  beforeAll(async () => {
    user = await createTestUser(admin, 'tg-link')
  }, 60_000)

  afterAll(async () => {
    await deleteTestUser(admin, user.id)
  }, 60_000)

  describe('the code', () => {
    it('is short enough to type from a phone', async () => {
      const { code } = await createLinkCode(admin, user.id)
      expect(code).toHaveLength(8)
    })

    it('avoids characters that get misread', async () => {
      // No O/0 or I/1: this gets read off a screen and typed into a phone,
      // and a code that fails because of a glyph is a code that gets retyped
      // three times.
      const { code } = await createLinkCode(admin, user.id)
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
    })

    it('expires soon', async () => {
      const { expiresAt } = await createLinkCode(admin, user.id)
      const minutes = (expiresAt.getTime() - Date.now()) / 60_000

      expect(minutes).toBeGreaterThan(0)
      expect(minutes).toBeLessThanOrEqual(15)
    })

    it('replaces the previous one rather than leaving both valid', async () => {
      const first = await createLinkCode(admin, user.id)
      await createLinkCode(admin, user.id)

      await expect(
        redeemLinkCode(admin, first.code, nextTelegramId(), 1),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('redeeming', () => {
    it('links the Telegram account to this one', async () => {
      const { code } = await createLinkCode(admin, user.id)
      const telegramId = nextTelegramId()

      const linked = await redeemLinkCode(admin, code, telegramId, 555)

      expect(linked.userId).toBe(user.id)
      expect(await resolveTelegramUser(admin, telegramId)).toBe(user.id)
    })

    it('can only be used once', async () => {
      const { code } = await createLinkCode(admin, user.id)
      await redeemLinkCode(admin, code, nextTelegramId(), 1)

      await expect(
        redeemLinkCode(admin, code, nextTelegramId(), 2),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('ignores case and spacing, since it gets typed by hand', async () => {
      const { code } = await createLinkCode(admin, user.id)
      const telegramId = nextTelegramId()

      await redeemLinkCode(admin, ` ${code.toLowerCase()} `, telegramId, 1)

      expect(await resolveTelegramUser(admin, telegramId)).toBe(user.id)
    })

    it('rejects a code nobody issued', async () => {
      await expect(
        redeemLinkCode(admin, 'ZZZZZZZZ', nextTelegramId(), 1),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('rejects an expired code', async () => {
      const { code } = await createLinkCode(admin, user.id)

      await admin
        .from('telegram_accounts')
        .update({ link_code_expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq('user_id', user.id)
        .eq('link_code', code)

      await expect(
        redeemLinkCode(admin, code, nextTelegramId(), 1),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it("refuses a Telegram account already linked to somebody else", async () => {
      const other = await createTestUser(admin, 'tg-thief')
      try {
        const telegramId = nextTelegramId()

        const mine = await createLinkCode(admin, user.id)
        await redeemLinkCode(admin, mine.code, telegramId, 1)

        const theirs = await createLinkCode(admin, other.id)
        await expect(
          redeemLinkCode(admin, theirs.code, telegramId, 1),
        ).rejects.toBeInstanceOf(ConflictError)

        // The original link is untouched.
        expect(await resolveTelegramUser(admin, telegramId)).toBe(user.id)
      } finally {
        await deleteTestUser(admin, other.id)
      }
    }, 60_000)
  })

  describe('resolving', () => {
    it('returns nothing for an id that was never linked', async () => {
      expect(await resolveTelegramUser(admin, nextTelegramId())).toBeNull()
    })

    it('returns nothing once the link is revoked', async () => {
      const { code } = await createLinkCode(admin, user.id)
      const telegramId = nextTelegramId()
      await redeemLinkCode(admin, code, telegramId, 1)

      await revokeTelegramLink(admin, user.id, telegramId)

      expect(await resolveTelegramUser(admin, telegramId)).toBeNull()
    })

    it('does not resolve an account still waiting to be linked', async () => {
      // A pending row exists as soon as a code is generated. It must not
      // authenticate anybody until a code has actually been redeemed.
      await createLinkCode(admin, user.id)

      const { data } = await admin
        .from('telegram_accounts')
        .select('status, telegram_user_id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle()

      expect(data?.status).toBe('pending')
      expect(data?.telegram_user_id).toBeNull()
    })
  })
})
