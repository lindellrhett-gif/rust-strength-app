-- 0035_friend_posts.sql
--
-- Sessions on a friend's profile (the grid), and the unit each post's volume is
-- in. Everything a friend can already fetch through rpc_friend_feed; nothing
-- new is shared.
--
-- 1. private.feed_posts holds what rpc_friend_feed did, with an optional
--    author. rpc_friend_feed and the new rpc_friend_posts both call it, so the
--    two can't come to disagree about who may see what: accepted friends only,
--    the author's "Show my sessions in the feed" switch, each run's own feed
--    switch and map choice, and blocks in both directions.
-- 2. rpc_friend_feed gains a last column, unit: the unit the author logs in.
--    Volume is stored in it, and the app used to label it with the viewer's
--    unit unconverted, so a kg lifter's 8,000 read as 8,000 lb. The column goes
--    at the end, so older apps that read by name carry on as they were.
--
-- Additive: safe to apply before 1.2 ships. Until it is applied, 1.2 fills the
-- grid from the ordinary feed, and leaves volumes unconverted as 1.1 does.

create schema if not exists private;

create or replace function private.feed_posts(
  p_limit  int,
  p_before timestamptz,
  p_author uuid
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
  my_reaction      text,
  route_preview    text,
  featured_trophies text[],
  unit             text
)
language sql
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
  where (p_author is null or a.uid = p_author)
    and (
      a.uid = m.uid
      or (
        coalesce((select p.share_workouts from profiles p where p.user_id = a.uid), true)
        and not exists (
          select 1 from user_blocks b
          where (b.blocker_id = m.uid and b.blocked_id = a.uid)
             or (b.blocker_id = a.uid and b.blocked_id = m.uid)
        )
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
  -- A run kept off the feed is still in your own.
  where (a.share_to_feed or a.user_id = auth.uid())
    and (p_before is null or a.performed_at < p_before)
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
    null::text                                                       as distance_unit,
    null::text                                                       as route_preview
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
    a.distance_unit::text   as distance_unit,
    -- The map only when its owner chose to share it (or it's your own run),
    -- and only the trimmed, simplified line: never the raw route, never the
    -- zones themselves.
    case
      when a.kind = 'run'
       and (a.user_id = auth.uid()
            or exists (select 1 from runs rn where rn.activity_id = a.id and rn.map_visibility = 'friends'))
      then run_shared_route(a.id)
    end                     as route_preview
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
  ) as my_reaction,
  p.route_preview,
  coalesce(pr.featured_trophies, '{}'::text[]) as featured_trophies,
  pr.unit::text as unit
from posts p
join profiles pr on pr.user_id = p.user_id
order by p.occurred_at desc;
$$;

-- Reached only through the two functions below, which run as its owner.
revoke all on function private.feed_posts(int, timestamptz, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- rpc_friend_feed: as in 0024, with unit added at the end.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_feed(int, timestamptz);

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
  my_reaction      text,
  route_preview    text,
  featured_trophies text[],
  unit             text
)
language sql
security definer
set search_path = public
stable
as $$
  select * from private.feed_posts(p_limit, p_before, null);
$$;

revoke all on function rpc_friend_feed(int, timestamptz) from public, anon;
grant execute on function rpc_friend_feed(int, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_friend_posts: one person's sessions, by the same rules. Nothing comes
-- back for someone who isn't your friend, or for no one in particular.
-- ---------------------------------------------------------------------------
create or replace function rpc_friend_posts(
  target   uuid,
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
  my_reaction      text,
  route_preview    text,
  featured_trophies text[],
  unit             text
)
language sql
security definer
set search_path = public
stable
as $$
  select * from private.feed_posts(p_limit, p_before, target) where target is not null;
$$;

revoke all on function rpc_friend_posts(uuid, int, timestamptz) from public, anon;
grant execute on function rpc_friend_posts(uuid, int, timestamptz) to authenticated;
