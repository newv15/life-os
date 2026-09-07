-- =============================================================================
-- 0016 - Liste
--
-- Due tabelle e non una: le voci non sono un campo di testo dentro la lista.
-- Con un blocco unico, spuntare una riga vuol dire riscrivere tutta la lista,
-- e da telefono, con una mano sola, è il modo di perdere pezzi.
-- =============================================================================

create table lists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  -- false = si svuota (la spesa), true = tiene lo storico (i film visti).
  -- È una proprietà della lista e non della voce: è la lista ad avere un
  -- carattere, e lo ha dal momento in cui la si crea.
  keeps_history boolean not null default false,
  archived_at   timestamptz,
  position      integer not null default 0,
  created_via   created_via not null default 'web',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lists_id_user_unique unique (id, user_id)
);

-- Una sola "spesa". Quando l'assistente risolve «aggiungi alla spesa» non
-- devono esistere due liste fra cui indovinare, e non deve poterne creare una
-- seconda perché la prima aveva la maiuscola.
create unique index lists_user_name_idx on lists (user_id, lower(name));
create index lists_user_position_idx on lists (user_id, position);

create table list_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  list_id     uuid not null,
  text        text not null,
  -- Quando, non se: costa lo stesso e conserva un'informazione che un booleano
  -- butta via per sempre.
  checked_at  timestamptz,
  position    integer not null default 0,
  created_via created_via not null default 'web',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Composita, come ogni altra relazione qui: il database rifiuta di attaccare
  -- la voce di un utente alla lista di un altro anche quando la RLS è
  -- scavalcata dalla service role. Cascade perché una voce senza la sua lista
  -- non significa niente.
  constraint list_items_list_fk foreign key (list_id, user_id)
    references lists (id, user_id) on delete cascade
);

create index list_items_list_idx on list_items (list_id, position);
create index list_items_open_idx on list_items (user_id) where checked_at is null;

create trigger lists_updated_at before update on lists
  for each row execute function set_updated_at();

create trigger list_items_updated_at before update on list_items
  for each row execute function set_updated_at();

alter table lists enable row level security;
alter table list_items enable row level security;

create policy own_rows on lists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_rows on list_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
