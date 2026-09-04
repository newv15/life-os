-- =============================================================================
-- 0010 - Backfill the bootstrap for users created before the trigger existed
--
-- The first account was created in the dashboard before 0007 was applied, so
-- the trigger never fired for it: no profile, no accounts, no categories. A
-- user in that state cannot record anything - "ho speso 35 euro" has nothing
-- to land on.
--
-- Rather than repeat the seed lists in a one-off script, the bootstrap moves
-- into its own function that both the trigger and the backfill call. One list,
-- one place, no drift. Every insert is ON CONFLICT DO NOTHING, so running it
-- again on an already-bootstrapped user is a no-op.
-- =============================================================================

create or replace function public.bootstrap_user(p_user_id uuid, p_full_name text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  insert into public.profiles (user_id, full_name)
  values (p_user_id, nullif(p_full_name, ''))
  on conflict (user_id) do nothing;

  insert into public.accounts (user_id, name, type)
  values (p_user_id, 'Conto principale', 'bank'),
         (p_user_id, 'Contanti', 'cash')
  on conflict do nothing;

  insert into public.categories (user_id, name, kind, is_system)
  select p_user_id, name, 'expense'::category_kind, true
  from unnest(array[
    'Spesa alimentare', 'Casa', 'Bollette', 'Trasporti', 'Carburante',
    'Salute', 'Ristoranti e bar', 'Svago', 'Abbigliamento', 'Tecnologia',
    'Abbonamenti', 'Formazione', 'Regali', 'Viaggi', 'Tasse e imposte', 'Altro'
  ]) as name
  on conflict do nothing;

  insert into public.categories (user_id, name, kind, is_system)
  select p_user_id, name, 'income'::category_kind, true
  from unnest(array[
    'Stipendio', 'Freelance', 'Rimborsi', 'Investimenti', 'Altro'
  ]) as name
  on conflict do nothing;

  insert into public.categories (user_id, name, kind, is_system)
  select p_user_id, name, 'task'::category_kind, true
  from unnest(array[
    'Lavoro', 'Personale', 'Casa', 'Salute', 'Studio', 'Burocrazia'
  ]) as name
  on conflict do nothing;
end;
$fn$;

-- Neither of these is an API: they are trigger and maintenance code.
revoke all on function public.bootstrap_user(uuid, text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  perform public.bootstrap_user(new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$fn$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- --- The backfill itself -----------------------------------------------------

do $backfill$
declare
  u record;
begin
  for u in
    select au.id, au.raw_user_meta_data ->> 'full_name' as full_name
    from auth.users au
    left join public.profiles p on p.user_id = au.id
    where p.user_id is null
  loop
    perform public.bootstrap_user(u.id, u.full_name);
  end loop;
end
$backfill$;
