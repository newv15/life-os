-- =============================================================================
-- 0002 - Life knowledge graph backbone: people, goals, projects, tasks, events
--
-- The spine is modelled with real foreign keys, not generic graph edges, so
-- "which tasks serve goal X?" is a join rather than a search.
--
-- Cross-entity references use COMPOSITE foreign keys (id, user_id) rather than
-- (id) alone. This is defence in depth: the Telegram and cron code paths run
-- with the service role, which bypasses RLS, so the database itself must refuse
-- to link one user's task to another user's project. MATCH SIMPLE semantics
-- mean the constraint is skipped when the optional id is null, which is exactly
-- the behaviour we want for nullable relations.
-- =============================================================================

create table people (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  full_name           text not null,
  relationship        text,
  company             text,
  role                text,
  email               text,
  phone               text,
  telegram_handle     text,
  notes               text,
  last_interaction_at timestamptz,
  next_action         text,
  next_action_at      timestamptz,
  created_via         created_via not null default 'web',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint people_id_user_key unique (id, user_id)
);

create index people_user_name_idx on people (user_id, lower(full_name));
create index people_next_action_idx
  on people (user_id, next_action_at) where next_action_at is not null;

create table goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  description    text,
  horizon        goal_horizon not null,
  parent_goal_id uuid,
  -- Numeric goals ("save 10.000 EUR") track values; qualitative goals leave
  -- target_value null and are driven by milestones instead.
  metric_unit    text,
  start_value    numeric(14, 2) not null default 0,
  target_value   numeric(14, 2),
  current_value  numeric(14, 2) not null default 0,
  deadline       date,
  status         goal_status not null default 'active',
  created_via    created_via not null default 'web',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint goals_id_user_key unique (id, user_id),
  constraint goals_not_own_parent check (parent_goal_id is null or parent_goal_id <> id),
  constraint goals_parent_fk foreign key (parent_goal_id, user_id)
    references goals (id, user_id) on delete set null
);

create index goals_user_status_idx   on goals (user_id, status);
create index goals_user_deadline_idx on goals (user_id, deadline) where deadline is not null;

create table goal_milestones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  goal_id      uuid not null,
  title        text not null,
  target_value numeric(14, 2),
  due_on       date,
  completed_at timestamptz,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint goal_milestones_goal_fk foreign key (goal_id, user_id)
    references goals (id, user_id) on delete cascade
);

create index goal_milestones_goal_idx on goal_milestones (goal_id, position);

create table projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  status      project_status not null default 'active',
  priority    priority_level not null default 'medium',
  started_on  date,
  deadline    date,
  goal_id     uuid,
  -- Progress is derived from tasks, but cached so the dashboard does not
  -- aggregate every project on every render.
  progress    smallint not null default 0 check (progress between 0 and 100),
  created_via created_via not null default 'web',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint projects_id_user_key unique (id, user_id),
  constraint projects_goal_fk foreign key (goal_id, user_id)
    references goals (id, user_id) on delete set null
);

create index projects_user_status_idx on projects (user_id, status);
create index projects_goal_idx        on projects (goal_id) where goal_id is not null;
create unique index projects_user_name_key on projects (user_id, lower(name));

create table tasks (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  title                text not null,
  description          text,
  status               task_status not null default 'todo',
  priority             priority_level not null default 'medium',
  category_id          uuid,
  project_id           uuid,
  goal_id              uuid,
  due_at               timestamptz,
  estimated_minutes    integer check (estimated_minutes is null or estimated_minutes > 0),
  actual_minutes       integer check (actual_minutes is null or actual_minutes >= 0),
  -- A deliberately reduced recurrence model, not full RRULE:
  -- {"freq":"weekly","interval":1,"days_of_week":[1,3,5]}
  recurrence_rule      jsonb,
  recurrence_parent_id uuid,
  completed_at         timestamptz,
  position             integer not null default 0,
  created_via          created_via not null default 'web',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Keep status and completed_at from drifting apart.
  constraint tasks_done_has_completed_at
    check ((status = 'done') = (completed_at is not null)),
  constraint tasks_id_user_key unique (id, user_id),
  constraint tasks_category_fk foreign key (category_id, user_id)
    references categories (id, user_id) on delete set null,
  constraint tasks_project_fk foreign key (project_id, user_id)
    references projects (id, user_id) on delete set null,
  constraint tasks_goal_fk foreign key (goal_id, user_id)
    references goals (id, user_id) on delete set null,
  constraint tasks_recurrence_parent_fk foreign key (recurrence_parent_id, user_id)
    references tasks (id, user_id) on delete set null
);

create index tasks_user_status_idx  on tasks (user_id, status);
create index tasks_user_due_idx     on tasks (user_id, due_at) where due_at is not null;
create index tasks_project_idx      on tasks (project_id) where project_id is not null;
create index tasks_goal_idx         on tasks (goal_id) where goal_id is not null;
create index tasks_open_updated_idx on tasks (user_id, updated_at)
  where status in ('inbox', 'todo', 'doing', 'blocked');

create table events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  location    text,
  project_id  uuid,
  person_id   uuid,
  created_via created_via not null default 'web',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_end_after_start check (ends_at is null or ends_at >= starts_at),
  constraint events_project_fk foreign key (project_id, user_id)
    references projects (id, user_id) on delete set null,
  constraint events_person_fk foreign key (person_id, user_id)
    references people (id, user_id) on delete set null
);

create index events_user_starts_idx on events (user_id, starts_at);
