-- =============================================================================
-- 0003 - Finance: accounts, transactions, budgets
--
-- Money is numeric(14,2), never a float. A transfer is ONE row referencing two
-- accounts, not two mirrored rows that can drift apart.
-- =============================================================================

create table accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  type            account_type not null default 'bank',
  currency        char(3) not null default 'EUR',
  opening_balance numeric(14, 2) not null default 0,
  -- Maintained by trigger from transactions; never written by hand.
  current_balance numeric(14, 2) not null default 0,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint accounts_id_user_key unique (id, user_id)
);

create unique index accounts_user_name_key on accounts (user_id, lower(name));
create index accounts_user_active_idx on accounts (user_id) where archived_at is null;

create table transactions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  account_id          uuid not null,
  -- Only set for transfers: the account the money lands in.
  transfer_account_id uuid,
  type                transaction_type not null,
  amount              numeric(14, 2) not null check (amount > 0),
  currency            char(3) not null default 'EUR',
  category_id         uuid,
  description         text,
  occurred_on         date not null default current_date,
  project_id          uuid,
  person_id           uuid,
  created_via         created_via not null default 'web',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- A transfer needs a destination and cannot land where it started;
  -- anything else must not carry one.
  constraint transactions_transfer_shape check (
    (type = 'transfer' and transfer_account_id is not null and transfer_account_id <> account_id)
    or (type <> 'transfer' and transfer_account_id is null)
  ),

  constraint transactions_account_fk foreign key (account_id, user_id)
    references accounts (id, user_id) on delete restrict,
  constraint transactions_transfer_account_fk foreign key (transfer_account_id, user_id)
    references accounts (id, user_id) on delete restrict,
  constraint transactions_category_fk foreign key (category_id, user_id)
    references categories (id, user_id) on delete set null,
  constraint transactions_project_fk foreign key (project_id, user_id)
    references projects (id, user_id) on delete set null,
  constraint transactions_person_fk foreign key (person_id, user_id)
    references people (id, user_id) on delete set null
);

create index transactions_user_date_idx     on transactions (user_id, occurred_on desc);
create index transactions_account_date_idx  on transactions (account_id, occurred_on desc);
create index transactions_user_cat_date_idx on transactions (user_id, category_id, occurred_on desc);

create table budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category_id uuid,
  period      budget_period not null default 'monthly',
  amount      numeric(14, 2) not null check (amount > 0),
  starts_on   date not null default current_date,
  ends_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint budgets_end_after_start check (ends_on is null or ends_on >= starts_on),
  constraint budgets_category_fk foreign key (category_id, user_id)
    references categories (id, user_id) on delete cascade
);

create index budgets_user_category_idx on budgets (user_id, category_id);

-- --- Balance maintenance -----------------------------------------------------

-- Deliberately NOT security definer: it runs with the caller's rights so RLS
-- still applies to the accounts it touches. The composite foreign keys above
-- already guarantee both accounts belong to the transaction's owner.
create or replace function public.sync_account_balances()
returns trigger
language plpgsql
as $fn$
begin
  -- Undo the old row's effect on the affected accounts.
  if tg_op in ('UPDATE', 'DELETE') then
    if old.type = 'income' then
      update accounts set current_balance = current_balance - old.amount
        where id = old.account_id;
    elsif old.type = 'expense' then
      update accounts set current_balance = current_balance + old.amount
        where id = old.account_id;
    else
      update accounts set current_balance = current_balance + old.amount
        where id = old.account_id;
      update accounts set current_balance = current_balance - old.amount
        where id = old.transfer_account_id;
    end if;
  end if;

  -- Apply the new row's effect.
  if tg_op in ('INSERT', 'UPDATE') then
    if new.type = 'income' then
      update accounts set current_balance = current_balance + new.amount
        where id = new.account_id;
    elsif new.type = 'expense' then
      update accounts set current_balance = current_balance - new.amount
        where id = new.account_id;
    else
      update accounts set current_balance = current_balance - new.amount
        where id = new.account_id;
      update accounts set current_balance = current_balance + new.amount
        where id = new.transfer_account_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$fn$;

create trigger transactions_sync_balances
  after insert or update or delete on transactions
  for each row execute function public.sync_account_balances();

-- Setting an opening balance after the fact should move the current balance by
-- the same delta, otherwise the two silently disagree.
create or replace function public.sync_opening_balance()
returns trigger
language plpgsql
as $fn$
begin
  if new.opening_balance is distinct from old.opening_balance then
    new.current_balance = new.current_balance + (new.opening_balance - old.opening_balance);
  end if;
  return new;
end;
$fn$;

create trigger accounts_sync_opening_balance
  before update on accounts
  for each row execute function public.sync_opening_balance();
