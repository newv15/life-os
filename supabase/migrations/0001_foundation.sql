-- =============================================================================
-- 0001 - Foundation: extensions, enums, shared helpers, identity, taxonomy
-- =============================================================================

create extension if not exists pg_trgm;

-- --- Enums -------------------------------------------------------------------

-- Where a record came from. Lets the UI show "creato da Telegram" and lets us
-- measure whether the AI-first promise is actually being used.
create type created_via as enum ('web', 'telegram', 'ai', 'system');

-- Every entity the knowledge graph, tagging, notifications and memories can
-- point at. Keep in sync with the tables below.
create type entity_type as enum (
  'task', 'project', 'goal', 'goal_milestone', 'event', 'transaction',
  'account', 'category', 'note', 'habit', 'person', 'journal_entry',
  'inbox_item', 'time_entry', 'memory'
);

create type telegram_link_status as enum ('pending', 'active', 'revoked');
create type category_kind        as enum ('expense', 'income', 'task', 'note', 'time');
create type goal_horizon         as enum ('yearly', 'quarterly', 'monthly', 'weekly');
create type goal_status          as enum ('active', 'paused', 'done', 'abandoned');
create type project_status       as enum ('idea', 'active', 'paused', 'done', 'archived');
create type task_status          as enum ('inbox', 'todo', 'doing', 'blocked', 'done', 'cancelled');
create type priority_level       as enum ('low', 'medium', 'high', 'urgent');
create type account_type         as enum ('cash', 'bank', 'card', 'savings', 'other');
create type transaction_type     as enum ('income', 'expense', 'transfer');
create type budget_period        as enum ('weekly', 'monthly', 'yearly');
create type habit_frequency      as enum ('daily', 'weekly', 'custom');
create type inbox_status         as enum ('pending', 'triaged', 'dismissed');
create type memory_kind          as enum ('preference', 'routine', 'rule', 'fact');
create type memory_source        as enum ('ai', 'user');
create type ai_channel           as enum ('web', 'telegram');
create type ai_role              as enum ('user', 'assistant', 'tool', 'system');
create type confirmation_result  as enum ('confirmed', 'rejected', 'expired');
create type notification_kind    as enum ('reminder', 'digest', 'alert', 'insight');
create type notification_status  as enum ('pending', 'sent', 'failed', 'cancelled');
create type notification_channel as enum ('telegram', 'web');
create type automation_kind      as enum (
  'daily_briefing', 'daily_review', 'weekly_review',
  'deadline_reminder', 'stale_task', 'budget_alert'
);

-- --- Shared helpers ----------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- --- Identity ----------------------------------------------------------------

-- The primary key column is named user_id (not id) on purpose: every table in
-- this schema carries user_id, which keeps RLS policies and repository code
-- uniform - there is no table where the ownership column has a different name.
create table profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  timezone     text        not null default 'Europe/Rome',
  locale       text        not null default 'it',
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table telegram_accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  telegram_user_id     bigint unique,
  chat_id              bigint,
  status               telegram_link_status not null default 'pending',
  link_code            text,
  link_code_expires_at timestamptz,
  linked_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- An active link must have resolved the Telegram identity.
  constraint active_link_has_identity
    check (status <> 'active' or (telegram_user_id is not null and chat_id is not null))
);

create unique index telegram_accounts_link_code_key
  on telegram_accounts (link_code) where link_code is not null;
create index telegram_accounts_user_id_idx on telegram_accounts (user_id);

-- --- Taxonomy ----------------------------------------------------------------

create table categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  kind       category_kind not null,
  color      text,
  icon       text,
  parent_id  uuid,
  is_system  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- (id, user_id) is the key children reference, so a cross-user link is
  -- impossible even when RLS is bypassed by the service role.
  constraint categories_id_user_key unique (id, user_id),
  constraint categories_parent_fk foreign key (parent_id, user_id)
    references categories (id, user_id) on delete set null
);

create unique index categories_user_kind_name_key
  on categories (user_id, kind, lower(name));
create index categories_user_kind_idx on categories (user_id, kind);

create table tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text,
  created_at timestamptz not null default now()
);

create unique index tags_user_name_key on tags (user_id, lower(name));

-- Polymorphic tagging. entity_id is intentionally not a foreign key: it points
-- at whichever table entity_type names.
create table taggables (
  tag_id      uuid not null references tags(id) on delete cascade,
  entity_type entity_type not null,
  entity_id   uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (tag_id, entity_type, entity_id)
);

create index taggables_entity_idx on taggables (user_id, entity_type, entity_id);

-- Life knowledge graph edges for cross-links the foreign keys do not cover
-- (a note about a person, a transaction that funds a goal, and so on).
create table entity_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  from_type  entity_type not null,
  from_id    uuid not null,
  to_type    entity_type not null,
  to_id      uuid not null,
  relation   text,
  created_at timestamptz not null default now(),
  constraint entity_links_no_self_link
    check (not (from_type = to_type and from_id = to_id))
);

create unique index entity_links_unique_edge
  on entity_links (user_id, from_type, from_id, to_type, to_id, coalesce(relation, ''));
create index entity_links_from_idx on entity_links (user_id, from_type, from_id);
create index entity_links_to_idx   on entity_links (user_id, to_type, to_id);
