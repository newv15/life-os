-- =============================================================================
-- 0015 - Closing what the API exposes
--
-- Two findings from the security audit at the end of M7.
--
-- 1. `rls_auto_enable()` is Supabase's own event trigger: it turns RLS on for
--    any table created in `public`, which is a safety net worth keeping. What
--    is not worth keeping is its EXECUTE grant to `anon` and `authenticated`,
--    which puts it on `/rest/v1/rpc/`. Calling it there already fails - an
--    event trigger function has no callable return type, and Postgres says so
--    with 0A000 - but a privileged function that anyone may attempt to call is
--    a door left ajar for no reason. The event trigger itself fires as the
--    system and is unaffected by the revoke.
--
-- 2. `telegram_updates` has RLS enabled and no policy, which the linter reports
--    and which is exactly right: only the webhook writes there, with the
--    service role, and no session should ever read it. Recorded as a comment so
--    the next person to see the warning knows it is a decision, not an
--    oversight.
-- =============================================================================

-- Revoked from PUBLIC, not from anon and authenticated: the grant is held by
-- the PUBLIC pseudo-role, so naming those two roles revokes nothing they
-- actually have. postgres and service_role keep their own explicit grants.
revoke execute on function public.rls_auto_enable() from public;

comment on table public.telegram_updates is
  'Update id di Telegram già elaborati, per non registrare due volte lo stesso '
  'messaggio quando Telegram ritenta. Scritta solo dal webhook con la service '
  'role: RLS attiva e nessuna policy, di proposito, perché nessuna sessione '
  'deve poterla leggere.';
