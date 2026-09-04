-- =============================================================================
-- 0007 - New user bootstrap
--
-- A brand new account must be immediately usable: "ho speso 35 euro al
-- supermercato" has to resolve to a real account and a real category on day
-- one, without the user configuring anything first.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));

  insert into public.accounts (user_id, name, type)
  values (new.id, 'Conto principale', 'bank'),
         (new.id, 'Contanti', 'cash');

  insert into public.categories (user_id, name, kind, is_system)
  select new.id, name, 'expense'::category_kind, true
  from unnest(array[
    'Spesa alimentare', 'Casa', 'Bollette', 'Trasporti', 'Carburante',
    'Salute', 'Ristoranti e bar', 'Svago', 'Abbigliamento', 'Tecnologia',
    'Abbonamenti', 'Formazione', 'Regali', 'Viaggi', 'Tasse e imposte', 'Altro'
  ]) as name;

  insert into public.categories (user_id, name, kind, is_system)
  select new.id, name, 'income'::category_kind, true
  from unnest(array[
    'Stipendio', 'Freelance', 'Rimborsi', 'Investimenti', 'Altro'
  ]) as name;

  insert into public.categories (user_id, name, kind, is_system)
  select new.id, name, 'task'::category_kind, true
  from unnest(array[
    'Lavoro', 'Personale', 'Casa', 'Salute', 'Studio', 'Burocrazia'
  ]) as name;

  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
