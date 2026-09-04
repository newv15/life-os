-- =============================================================================
-- 0008 - Global search
--
-- No search index table and no embeddings in v1: a single function unions the
-- searchable tables. Semantic search stays a later, optional addition.
--
-- Security invoker on purpose, and it still filters on p_user_id explicitly, so
-- it is safe on both paths: RLS constrains browser sessions, and the explicit
-- filter constrains the service-role calls where RLS does not apply.
-- =============================================================================

create type search_result as (
  entity_type entity_type,
  entity_id   uuid,
  title       text,
  snippet     text,
  occurred_at timestamptz,
  rank        real
);

create or replace function public.global_search(
  p_user_id uuid,
  p_query   text,
  p_limit   integer default 30
)
returns setof search_result
language sql
stable
as $fn$
  with q as (select '%' || trim(p_query) || '%' as like_pattern, trim(p_query) as raw)
  select * from (
    select 'task'::entity_type, t.id, t.title, left(coalesce(t.description, ''), 160),
           t.created_at, similarity(t.title, (select raw from q))
      from tasks t, q
     where t.user_id = p_user_id
       and (t.title ilike q.like_pattern or t.description ilike q.like_pattern)

    union all
    select 'project'::entity_type, p.id, p.name, left(coalesce(p.description, ''), 160),
           p.created_at, similarity(p.name, (select raw from q))
      from projects p, q
     where p.user_id = p_user_id
       and (p.name ilike q.like_pattern or p.description ilike q.like_pattern)

    union all
    select 'goal'::entity_type, g.id, g.title, left(coalesce(g.description, ''), 160),
           g.created_at, similarity(g.title, (select raw from q))
      from goals g, q
     where g.user_id = p_user_id
       and (g.title ilike q.like_pattern or g.description ilike q.like_pattern)

    union all
    select 'note'::entity_type, n.id, coalesce(n.title, left(n.body, 60)),
           left(n.body, 160), n.created_at,
           similarity(coalesce(n.title, '') || ' ' || n.body, (select raw from q))
      from notes n, q
     where n.user_id = p_user_id
       and (n.title ilike q.like_pattern or n.body ilike q.like_pattern)

    union all
    select 'person'::entity_type, pe.id, pe.full_name,
           left(coalesce(pe.notes, coalesce(pe.relationship, '')), 160),
           pe.created_at, similarity(pe.full_name, (select raw from q))
      from people pe, q
     where pe.user_id = p_user_id
       and (pe.full_name ilike q.like_pattern or pe.notes ilike q.like_pattern
            or pe.company ilike q.like_pattern)

    union all
    select 'event'::entity_type, e.id, e.title, left(coalesce(e.location, ''), 160),
           e.starts_at, similarity(e.title, (select raw from q))
      from events e, q
     where e.user_id = p_user_id
       and (e.title ilike q.like_pattern or e.description ilike q.like_pattern
            or e.location ilike q.like_pattern)

    union all
    select 'transaction'::entity_type, tr.id,
           coalesce(tr.description, tr.amount::text || ' EUR'),
           tr.amount::text || ' EUR', tr.created_at,
           similarity(coalesce(tr.description, ''), (select raw from q))
      from transactions tr, q
     where tr.user_id = p_user_id
       and tr.description ilike q.like_pattern

    union all
    select 'inbox_item'::entity_type, i.id, left(i.raw_text, 60),
           left(i.raw_text, 160), i.created_at,
           similarity(i.raw_text, (select raw from q))
      from inbox_items i, q
     where i.user_id = p_user_id
       and i.raw_text ilike q.like_pattern

    union all
    select 'memory'::entity_type, m.id, m.title, left(m.content, 160),
           m.created_at, similarity(m.title || ' ' || m.content, (select raw from q))
      from memories m, q
     where m.user_id = p_user_id
       and m.active
       and (m.title ilike q.like_pattern or m.content ilike q.like_pattern)
  ) results (entity_type, entity_id, title, snippet, occurred_at, rank)
  order by rank desc nulls last, occurred_at desc
  limit greatest(p_limit, 1);
$fn$;
