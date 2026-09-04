-- =============================================================================
-- 0005 - AI engine, audit trail, notifications, automation
-- =============================================================================

-- Long-term personal memory. Written ONLY through the `remember` tool, never
-- automatically from every message. It never replaces structured data: when
-- memory and the tables disagree, the tables win.
create table memories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         memory_kind not null default 'fact',
  title        text not null,
  content      text not null,
  source       memory_source not null default 'ai',
  confidence   smallint not null default 100 check (confidence between 0 and 100),
  entity_type  entity_type,
  entity_id    uuid,
  last_used_at timestamptz,
  expires_at   timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index memories_user_active_idx on memories (user_id) where active;
create index memories_search_idx on memories
  using gin ((title || ' ' || content) gin_trgm_ops);

create table ai_conversations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  channel          ai_channel not null,
  telegram_chat_id bigint,
  title            text,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint ai_conversations_id_user_key unique (id, user_id)
);

create index ai_conversations_user_recent_idx
  on ai_conversations (user_id, last_message_at desc);
-- One rolling conversation per Telegram chat, so context survives between
-- messages without unbounded growth.
create unique index ai_conversations_telegram_chat_key
  on ai_conversations (user_id, telegram_chat_id)
  where telegram_chat_id is not null;

create table ai_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  role            ai_role not null,
  content         text,
  tool_calls      jsonb,
  tokens_in       integer,
  tokens_out      integer,
  created_at      timestamptz not null default now(),
  constraint ai_messages_id_user_key unique (id, user_id),
  constraint ai_messages_conversation_fk foreign key (conversation_id, user_id)
    references ai_conversations (id, user_id) on delete cascade
);

create index ai_messages_conversation_idx on ai_messages (conversation_id, created_at desc);

-- Full audit trail: every tool the AI actually ran, with what and to what
-- effect. This is what makes "why did it do that?" answerable.
create table ai_action_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid,
  message_id      uuid,
  intent          text,
  tool_name       text not null,
  arguments       jsonb,
  result          jsonb,
  success         boolean not null,
  error           text,
  duration_ms     integer,
  created_at      timestamptz not null default now(),
  constraint ai_action_logs_conversation_fk foreign key (conversation_id, user_id)
    references ai_conversations (id, user_id) on delete set null,
  constraint ai_action_logs_message_fk foreign key (message_id, user_id)
    references ai_messages (id, user_id) on delete set null
);

create index ai_action_logs_user_recent_idx on ai_action_logs (user_id, created_at desc);
create index ai_action_logs_tool_idx on ai_action_logs (user_id, tool_name, created_at desc);

-- The Telegram webhook is stateless: a confirmation ("delete project X and its
-- 18 tasks?") is answered in a LATER http request, so the pending arguments
-- must outlive the AI context that produced them.
create table pending_confirmations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid,
  tool_name       text not null,
  arguments       jsonb not null,
  summary         text not null,
  expires_at      timestamptz not null default (now() + interval '15 minutes'),
  resolved_at     timestamptz,
  resolution      confirmation_result,
  created_at      timestamptz not null default now(),
  constraint pending_confirmations_resolved_shape
    check ((resolved_at is null) = (resolution is null)),
  constraint pending_confirmations_conversation_fk foreign key (conversation_id, user_id)
    references ai_conversations (id, user_id) on delete cascade
);

create index pending_confirmations_open_idx on pending_confirmations (user_id, expires_at)
  where resolved_at is null;

-- Reminders and notifications are the same thing at different points in time:
-- a reminder is simply a notification whose scheduled_at is still in the
-- future. One table means the cron tick runs a single query.
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         notification_kind not null default 'reminder',
  title        text not null,
  body         text,
  entity_type  entity_type,
  entity_id    uuid,
  scheduled_at timestamptz not null default now(),
  channel      notification_channel not null default 'telegram',
  status       notification_status not null default 'pending',
  sent_at      timestamptz,
  read_at      timestamptz,
  attempts     smallint not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- The query the cron tick runs every 5 minutes.
create index notifications_due_idx on notifications (scheduled_at)
  where status = 'pending';
create index notifications_user_feed_idx on notifications (user_id, created_at desc);

create table automation_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        automation_kind not null,
  enabled     boolean not null default true,
  -- e.g. {"time_of_day":"07:30","days":[1,2,3,4,5]} interpreted in the
  -- profile's timezone, not UTC.
  config      jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index automation_rules_user_kind_key on automation_rules (user_id, kind);
create index automation_rules_due_idx on automation_rules (next_run_at) where enabled;

-- Telegram retries an update until it gets a 200. Without this table a retried
-- "ho speso 35 euro" would be recorded twice.
create table telegram_updates (
  update_id    bigint primary key,
  processed_at timestamptz not null default now()
);

-- --- updated_at triggers -----------------------------------------------------

-- Applied by introspection so no table can be forgotten as the schema grows.
do $trg$
declare
  t record;
begin
  for t in
    select table_name
    from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t.table_name
    );
  end loop;
end
$trg$;
