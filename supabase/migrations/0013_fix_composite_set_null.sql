-- =============================================================================
-- 0013 - Restrict ON DELETE SET NULL to the referencing column
--
-- The composite foreign keys from 0002-0005 pair every reference with user_id,
-- so the database itself refuses to link one user's rows to another's. That
-- part works. What did not work was deleting the parent.
--
-- ON DELETE SET NULL on a composite key nulls EVERY referencing column, and
-- user_id is NOT NULL - so deleting a project tried to null the owner of each
-- of its tasks and failed outright:
--
--   null value in column "user_id" of relation "tasks" violates not-null
--
-- In practice: no project and no goal could ever be deleted once anything
-- pointed at it. Postgres 15 added a column list for exactly this, so each
-- constraint now nulls only its own reference and leaves the owner alone.
-- =============================================================================

alter table ai_action_logs drop constraint ai_action_logs_conversation_fk;
alter table ai_action_logs add constraint ai_action_logs_conversation_fk
  foreign key (conversation_id, user_id) references ai_conversations (id, user_id)
  on delete set null (conversation_id);

alter table ai_action_logs drop constraint ai_action_logs_message_fk;
alter table ai_action_logs add constraint ai_action_logs_message_fk
  foreign key (message_id, user_id) references ai_messages (id, user_id)
  on delete set null (message_id);

alter table categories drop constraint categories_parent_fk;
alter table categories add constraint categories_parent_fk
  foreign key (parent_id, user_id) references categories (id, user_id)
  on delete set null (parent_id);

alter table events drop constraint events_person_fk;
alter table events add constraint events_person_fk
  foreign key (person_id, user_id) references people (id, user_id)
  on delete set null (person_id);

alter table events drop constraint events_project_fk;
alter table events add constraint events_project_fk
  foreign key (project_id, user_id) references projects (id, user_id)
  on delete set null (project_id);

alter table goals drop constraint goals_parent_fk;
alter table goals add constraint goals_parent_fk
  foreign key (parent_goal_id, user_id) references goals (id, user_id)
  on delete set null (parent_goal_id);

alter table habits drop constraint habits_goal_fk;
alter table habits add constraint habits_goal_fk
  foreign key (goal_id, user_id) references goals (id, user_id)
  on delete set null (goal_id);

alter table notes drop constraint notes_category_fk;
alter table notes add constraint notes_category_fk
  foreign key (category_id, user_id) references categories (id, user_id)
  on delete set null (category_id);

alter table notes drop constraint notes_goal_fk;
alter table notes add constraint notes_goal_fk
  foreign key (goal_id, user_id) references goals (id, user_id)
  on delete set null (goal_id);

alter table notes drop constraint notes_person_fk;
alter table notes add constraint notes_person_fk
  foreign key (person_id, user_id) references people (id, user_id)
  on delete set null (person_id);

alter table notes drop constraint notes_project_fk;
alter table notes add constraint notes_project_fk
  foreign key (project_id, user_id) references projects (id, user_id)
  on delete set null (project_id);

alter table projects drop constraint projects_goal_fk;
alter table projects add constraint projects_goal_fk
  foreign key (goal_id, user_id) references goals (id, user_id)
  on delete set null (goal_id);

alter table tasks drop constraint tasks_category_fk;
alter table tasks add constraint tasks_category_fk
  foreign key (category_id, user_id) references categories (id, user_id)
  on delete set null (category_id);

alter table tasks drop constraint tasks_goal_fk;
alter table tasks add constraint tasks_goal_fk
  foreign key (goal_id, user_id) references goals (id, user_id)
  on delete set null (goal_id);

alter table tasks drop constraint tasks_project_fk;
alter table tasks add constraint tasks_project_fk
  foreign key (project_id, user_id) references projects (id, user_id)
  on delete set null (project_id);

alter table tasks drop constraint tasks_recurrence_parent_fk;
alter table tasks add constraint tasks_recurrence_parent_fk
  foreign key (recurrence_parent_id, user_id) references tasks (id, user_id)
  on delete set null (recurrence_parent_id);

alter table time_entries drop constraint time_entries_category_fk;
alter table time_entries add constraint time_entries_category_fk
  foreign key (category_id, user_id) references categories (id, user_id)
  on delete set null (category_id);

alter table time_entries drop constraint time_entries_project_fk;
alter table time_entries add constraint time_entries_project_fk
  foreign key (project_id, user_id) references projects (id, user_id)
  on delete set null (project_id);

alter table time_entries drop constraint time_entries_task_fk;
alter table time_entries add constraint time_entries_task_fk
  foreign key (task_id, user_id) references tasks (id, user_id)
  on delete set null (task_id);

alter table transactions drop constraint transactions_category_fk;
alter table transactions add constraint transactions_category_fk
  foreign key (category_id, user_id) references categories (id, user_id)
  on delete set null (category_id);

alter table transactions drop constraint transactions_person_fk;
alter table transactions add constraint transactions_person_fk
  foreign key (person_id, user_id) references people (id, user_id)
  on delete set null (person_id);

alter table transactions drop constraint transactions_project_fk;
alter table transactions add constraint transactions_project_fk
  foreign key (project_id, user_id) references projects (id, user_id)
  on delete set null (project_id);
