-- =============================================================================
-- 0012 - Drop the cached project progress column
--
-- 0002 added projects.progress "so the dashboard does not aggregate every
-- project on every render". That was a guess at a performance problem this
-- system does not have: one person has a handful of projects, and the progress
-- of each is two counts over their tasks.
--
-- Keeping it would mean every write path that touches a task - the web, the AI
-- tools, the cron tick - has to remember to recompute it, and the first one
-- that forgets leaves a number on screen that quietly disagrees with the tasks
-- underneath it. A column that can lie is worse than a column that costs a
-- count, so progress is derived on read instead.
-- =============================================================================

alter table projects drop column progress;
