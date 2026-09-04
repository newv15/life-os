-- =============================================================================
-- 0004 - Daily life: habits, journal, notes, inbox, time tracking
-- =============================================================================

create table habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  description      text,
  frequency        habit_frequency not null default 'daily',
  target_per_period smallint not null default 1 check (target_per_period > 0),
  -- ISO weekday numbers (1 = Monday .. 7 = Sunday) for weekly/custom habits.
  days_of_week     smallint[] not null default '{}',
  goal_id          uuid,
  active           boolean not null default true,
  created_via      created_via not null default 'web',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint habits_id_user_key unique (id, user_id),
  constraint habits_days_of_week_valid
    check (days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]),
  constraint habits_goal_fk foreign key (goal_id, user_id)
    references goals (id, user_id) on delete set null
);

create unique index habits_user_name_key on habits (user_id, lower(name));
create index habits_user_active_idx on habits (user_id) where active;

create table habit_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  habit_id   uuid not null,
  entry_date date not null default current_date,
  done       boolean not null default true,
  quantity   smallint not null default 1 check (quantity >= 0),
  note       text,
  created_at timestamptz not null default now(),
  constraint habit_entries_habit_fk foreign key (habit_id, user_id)
    references habits (id, user_id) on delete cascade
);

create unique index habit_entries_habit_date_key on habit_entries (habit_id, entry_date);
create index habit_entries_user_date_idx on habit_entries (user_id, entry_date desc);

create table journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_date  date not null default current_date,
  body        text,
  energy      smallint check (energy between 1 and 5),
  mood        smallint check (mood between 1 and 5),
  wins        text,
  blockers    text,
  reflections text,
  next_goals  text,
  created_via created_via not null default 'web',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One journal entry per day: writing again the same day updates it.
create unique index journal_entries_user_date_key on journal_entries (user_id, entry_date);

create table notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text,
  body        text not null,
  category_id uuid,
  project_id  uuid,
  goal_id     uuid,
  person_id   uuid,
  pinned      boolean not null default false,
  archived_at timestamptz,
  created_via created_via not null default 'web',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('italian', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored,
  constraint notes_category_fk foreign key (category_id, user_id)
    references categories (id, user_id) on delete set null,
  constraint notes_project_fk foreign key (project_id, user_id)
    references projects (id, user_id) on delete set null,
  constraint notes_goal_fk foreign key (goal_id, user_id)
    references goals (id, user_id) on delete set null,
  constraint notes_person_fk foreign key (person_id, user_id)
    references people (id, user_id) on delete set null
);

create index notes_search_idx on notes using gin (search_vector);
create index notes_user_created_idx on notes (user_id, created_at desc)
  where archived_at is null;

-- Anything that arrives without needing an immediate decision. Also the safety
-- net: when the AI is unavailable, raw input is parked here instead of lost.
create table inbox_items (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  raw_text              text not null,
  source                created_via not null default 'web',
  status                inbox_status not null default 'pending',
  -- What the AI thinks this is: {"type":"idea","category":"SaaS","priority":"low"}
  ai_suggestion         jsonb,
  promoted_entity_type  entity_type,
  promoted_entity_id    uuid,
  triaged_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint inbox_items_triaged_shape
    check ((status = 'pending') = (triaged_at is null))
);

create index inbox_items_user_pending_idx on inbox_items (user_id, created_at desc)
  where status = 'pending';

create table time_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  task_id     uuid,
  project_id  uuid,
  category_id uuid,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  note        text,
  created_via created_via not null default 'web',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint time_entries_end_after_start check (ended_at is null or ended_at > started_at),
  constraint time_entries_task_fk foreign key (task_id, user_id)
    references tasks (id, user_id) on delete set null,
  constraint time_entries_project_fk foreign key (project_id, user_id)
    references projects (id, user_id) on delete set null,
  constraint time_entries_category_fk foreign key (category_id, user_id)
    references categories (id, user_id) on delete set null
);

-- "Ho iniziato a lavorare" twice in a row must not silently open two timers:
-- the database guarantees at most one running entry per user.
create unique index time_entries_one_running_per_user
  on time_entries (user_id) where ended_at is null;
create index time_entries_user_started_idx on time_entries (user_id, started_at desc);
