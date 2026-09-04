-- =============================================================================
-- 0009 - Hardening, from the Supabase security advisor
--
-- Three findings, all real:
--
--  1. Our functions had a mutable search_path. A function whose search_path is
--     resolved at call time can be made to run someone else's `now()` or
--     `similarity()` by a caller who controls the path. Pinning it removes the
--     whole class of problem.
--  2. handle_new_user() is SECURITY DEFINER and lived in the API schema, so it
--     was reachable at /rest/v1/rpc/handle_new_user by anyone, signed in or
--     not. It is a trigger body and must never be callable directly.
--  3. pg_trgm sat in `public`, mixing extension objects with application
--     tables in the exposed schema.
--
-- Not fixed, on purpose: telegram_updates has RLS enabled and no policy. The
-- advisor flags that as INFO; here it is the intent. The table is written only
-- by the webhook under the service role, and no browser session should reach
-- it at all - no policy is exactly how you say that.
-- =============================================================================

-- --- 1. Pin search_path ------------------------------------------------------

alter function public.set_updated_at()
  set search_path = public, pg_temp;

alter function public.sync_account_balances()
  set search_path = public, pg_temp;

alter function public.sync_opening_balance()
  set search_path = public, pg_temp;

-- global_search calls similarity(), which lives in pg_trgm - so `extensions`
-- has to stay reachable here after the move below.
alter function public.global_search(uuid, text, integer)
  set search_path = public, extensions, pg_temp;

-- --- 2. Close the RPC surface ------------------------------------------------

-- A trigger body is not an API. Postgres still runs it as the trigger owner.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Search is for signed-in sessions only; anon has no rows to find anyway, but
-- the endpoint should not exist for it.
revoke all on function public.global_search(uuid, text, integer) from anon;
grant execute on function public.global_search(uuid, text, integer) to authenticated;

-- --- 3. Move the extension out of the exposed schema --------------------------

-- `extensions` is already on the default search_path for this database, so
-- calls to similarity() and the gin_trgm_ops opclass keep resolving.
alter extension pg_trgm set schema extensions;
