-- Rust Strength — Milestone 9: feed hardening
--
-- Two findings from the pre-launch review of 0008.
--
--   1. PRIVACY. The privacy policy says of feed reactions: "You see how many of
--      each reaction a post received, but not who left them." The select policy
--      was looser than that — it let you read the reaction *rows* on any post by
--      a friend, which includes the user id of whoever left each one. The app's
--      own UI only ever showed counts, but the API did not enforce it, and an
--      undertaking in a privacy policy has to be enforced by the database, not
--      by the client being polite.
--
--      Direct reads are now limited to your own reaction rows. Counts and
--      "which one did I leave" still come from rpc_friend_feed, which is
--      SECURITY DEFINER and returns aggregates plus your own reaction only.
--
--   2. PERFORMANCE. rpc_friend_feed computed per-workout aggregates — including
--      a correlated "was this a personal record" subquery per exercise — for
--      *every* finished workout belonging to every friend, and only then
--      ordered and applied the limit. With a handful of friends and a couple of
--      years of training each, that is thousands of subqueries to render thirty
--      cards. The candidate rows are now picked and limited first, off the
--      existing (user_id, started_at desc) index, and the expensive work runs
--      only on those.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Reactions are readable only by the person who left them.
-- ---------------------------------------------------------------------------
drop policy if exists feed_reactions_select on feed_reactions;

create policy feed_reactions_select on feed_reactions
  for select using (user_id = auth.uid());

-- Account deletion removes every reaction a user left, which is a scan without
-- this.
create index if not exists feed_reactions_user_idx on feed_reactions (user_id);

-- ---------------------------------------------------------------------------
-- 2. rpc_friend_feed — same columns, same guarantees, bounded work.
--
-- Authorship is still gated three ways before a row is considered: accepted
-- friendship, the author's sharing preference, and no block in either
-- direction. A post is still a summary; individual sets never leave the server.
-- ---------------------------------------------------------------------------
create or replace function rpc_friend_feed(
  p_limit  int default 30,
  p_before timestamptz default null
)
returns table (
  subject_type     text,
  subject_id       uuid,
  user_id          uuid,
  username         text,
  display_name     text,
  occurred_at      timestamptz,
  name             text,
  duration_seconds int,
  volume           double precision,
  total_sets       int,
  total_reps       int,
  exercise_names   text[],
  record_count     int,
  activity_kind    text,
  distance         double precision,
  distance_unit    text,
  badge_ids        text[],
  reaction_counts  jsonb,
  my_reaction      text
)
language sql
security definer
set search_path = public
stable
as $$
with me as (
  select auth.uid() as uid
),
authors as (
  select
    case when f.requester_id = m.uid then f.addressee_id else f.requester_id end as uid
  from friendships f
  cross join me m
  where f.status = 'accepted'
    and (f.requester_id = m.uid or f.addressee_id = m.uid)
  union
  select uid from me
),
allowed as (
  select a.uid
  from authors a
  cross join me m
  where a.uid = m.uid
     or (
       coalesce((select p.share_workouts from profiles p where p.user_id = a.uid), true)
       and not exists (
         select 1 from user_blocks b
         where (b.blocker_id = m.uid and b.blocked_id = a.uid)
            or (b.blocker_id = a.uid and b.blocked_id = m.uid)
       )
     )
),

-- Candidates first. These two reads are index-only work and cap how many rows
-- the aggregates below ever touch.
workout_candidates as (
  select w.id, w.user_id, w.started_at, w.ended_at, w.name
  from workouts w
  join allowed al on al.uid = w.user_id
  where w.ended_at is not null
    and (p_before is null or w.started_at < p_before)
  order by w.started_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
),
activity_candidates as (
  select a.id, a.user_id, a.performed_at, a.name, a.duration_seconds,
         a.kind, a.distance, a.distance_unit
  from activities a
  join allowed al on al.uid = a.user_id
  where p_before is null or a.performed_at < p_before
  order by a.performed_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
),

workout_posts as (
  select
    'workout'::text                                                  as subject_type,
    w.id                                                             as subject_id,
    w.user_id                                                        as user_id,
    w.started_at                                                     as occurred_at,
    w.name                                                           as name,
    greatest(0, extract(epoch from (w.ended_at - w.started_at)))::int as duration_seconds,
    coalesce(agg.volume, 0)::float8                                  as volume,
    coalesce(agg.total_sets, 0)::int                                 as total_sets,
    coalesce(agg.total_reps, 0)::int                                 as total_reps,
    coalesce(names.names, '{}'::text[])                              as exercise_names,
    coalesce(recs.n, 0)::int                                         as record_count,
    null::text                                                       as activity_kind,
    null::float8                                                     as distance,
    null::text                                                       as distance_unit
  from workout_candidates w
  left join lateral (
    select
      sum(s.weight * s.reps) as volume,
      count(*)               as total_sets,
      sum(s.reps)            as total_reps
    from sets s
    where s.workout_id = w.id and s.is_warmup = false
  ) agg on true
  left join lateral (
    -- Exercises in the order they were first worked, so the chips read like
    -- the session did.
    select array_agg(x.ex_name order by x.first_order) as names
    from (
      select e.name as ex_name, min(s.order_index) as first_order
      from sets s
      join exercises e on e.id = s.exercise_id
      where s.workout_id = w.id and s.is_warmup = false
      group by e.name
    ) x
  ) names on true
  left join lateral (
    -- A record is an exercise whose best e1RM in this session beat everything
    -- the user had done before it. Same test as rpc_workout_summary.
    select count(*)::int as n
    from (
      select s.exercise_id, max(s.e1rm) as best
      from sets s
      where s.workout_id = w.id and s.is_warmup = false
      group by s.exercise_id
    ) cur
    where cur.best > 0
      and cur.best > coalesce((
        select max(p.e1rm)
        from sets p
        where p.user_id = w.user_id
          and p.exercise_id = cur.exercise_id
          and p.is_warmup = false
          and p.workout_id <> w.id
          and p.performed_at < w.started_at
      ), 0)
  ) recs on true
),
activity_posts as (
  select
    'activity'::text        as subject_type,
    a.id                    as subject_id,
    a.user_id               as user_id,
    a.performed_at          as occurred_at,
    a.name                  as name,
    a.duration_seconds      as duration_seconds,
    0::float8               as volume,
    0                       as total_sets,
    0                       as total_reps,
    '{}'::text[]            as exercise_names,
    0                       as record_count,
    a.kind::text            as activity_kind,
    a.distance::float8      as distance,
    a.distance_unit::text   as distance_unit
  from activity_candidates a
),
posts as (
  select * from workout_posts
  union all
  select * from activity_posts
  order by occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
)
select
  p.subject_type,
  p.subject_id,
  p.user_id,
  pr.username,
  pr.display_name,
  p.occurred_at,
  p.name,
  p.duration_seconds,
  p.volume,
  p.total_sets,
  p.total_reps,
  p.exercise_names,
  p.record_count,
  p.activity_kind,
  p.distance,
  p.distance_unit,
  coalesce((
    select array_agg(pb.badge_id order by pb.granted_at)
    from profile_badges pb
    where pb.user_id = p.user_id
  ), '{}'::text[]) as badge_ids,
  coalesce((
    select jsonb_object_agg(r.reaction, r.n)
    from (
      select fr.reaction, count(*) as n
      from feed_reactions fr
      where fr.subject_type = p.subject_type and fr.subject_id = p.subject_id
      group by fr.reaction
    ) r
  ), '{}'::jsonb) as reaction_counts,
  (
    select fr.reaction
    from feed_reactions fr
    where fr.subject_type = p.subject_type
      and fr.subject_id = p.subject_id
      and fr.user_id = auth.uid()
  ) as my_reaction
from posts p
join profiles pr on pr.user_id = p.user_id
order by p.occurred_at desc;
$$;

revoke all on function rpc_friend_feed(int, timestamptz) from public;
grant execute on function rpc_friend_feed(int, timestamptz) to authenticated;
