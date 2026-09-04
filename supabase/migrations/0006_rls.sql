-- =============================================================================
-- 0006 - Row Level Security
--
-- Security does not depend on the frontend. Every table carries user_id and
-- gets the same policy, applied by introspection so a table added later cannot
-- be silently left unprotected.
--
-- Known and accepted limitation: the Telegram webhook and the cron tick run
-- with the service role, which bypasses RLS entirely. On those paths the
-- guarantee comes from the repository layer (user_id is a required argument on
-- every function) and from the composite foreign keys in 0002-0004.
-- =============================================================================

do $rls$
declare
  t record;
begin
  for t in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.table_name);
  end loop;

  -- Every table that carries an ownership column gets the uniform policy.
  for t in
    select table_name
    from information_schema.columns
    where table_schema = 'public' and column_name = 'user_id'
  loop
    execute format(
      'create policy own_rows on public.%I
         for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t.table_name
    );
  end loop;
end
$rls$;

-- telegram_updates has no user_id: it is a bookkeeping table written only by
-- the webhook under the service role. RLS is enabled above and it deliberately
-- has no policy, so no browser session can read or write it at all.
