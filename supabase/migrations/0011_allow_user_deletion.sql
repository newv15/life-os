-- =============================================================================
-- 0011 - Let a user actually be deleted
--
-- transactions.account_id references accounts with ON DELETE RESTRICT. That is
-- the right rule for one account: deleting a bank account should never quietly
-- erase the movements recorded against it.
--
-- But removing a user cascades into their accounts, and the restriction blocked
-- that cascade - so anyone who had ever recorded a single movement could not be
-- deleted at all. "Export your data and then remove it" is a promise this
-- system makes, and it was not being kept.
--
-- The fix keeps both properties: the guard on individual accounts stays, and a
-- BEFORE DELETE trigger clears the ledger first so the cascade can proceed.
-- =============================================================================

create or replace function public.handle_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  -- Everything else in the schema reaches auth.users through ON DELETE CASCADE
  -- and needs no help. Only the transactions-to-accounts restriction does.
  delete from public.transactions where user_id = old.id;
  return old;
end;
$fn$;

-- Maintenance code, not an API.
revoke all on function public.handle_user_deleted() from public, anon, authenticated;

create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function public.handle_user_deleted();
