-- 0037_friend_bests_bodyweight.sql
--
-- A friend's personal bests no longer give away their bodyweight.
--
-- rpc_friend_prs (0008) sent friends the heaviest weight and best estimated max
-- for every exercise. On bodyweight and assisted exercises those numbers are
-- the person's bodyweight, plus or minus the weight added or the assistance, so
-- a friend could read someone's bodyweight off a pull-up. The Privacy Policy
-- says nobody sees your bodyweight.
--
-- 1. rpc_friend_prs gains a last column, bodyweight: true for an exercise that
--    is bodyweight or assisted, or that has a set logged with the BW button or
--    with added weight or assistance. For those, a friend now gets the reps and
--    no weight or estimated max: the app shows BW. You still get your own
--    numbers.
-- 2. rpc_friend_stats gains a last column, strength_score: the sum of the best
--    estimated max on each exercise, which is what a level's strength XP is
--    worked out from. For a friend it leaves out the exercises shown as BW, or
--    the total minus the visible ones would give their bodyweight away; so a
--    friend's level can read a little lower than their own.
-- 3. Volume a friend sees leaves out bodyweight sets, whose weight is the
--    person's bodyweight plus or minus what was added or assisted: total_volume
--    in rpc_friend_stats, a session's volume on the feed (private.feed_posts)
--    and the weight-lifted board (rpc_friend_leaderboard). Your own figures
--    are unchanged.
--
-- APPLY ON 1.2 RELEASE DAY, with 0034. Until then 0034's gap means a friend can
-- read bodyweight from the profile row anyway, and 1.1 works out a friend's
-- level from the per-exercise numbers, so once this is on, 1.1 shows friends
-- who do bodyweight work a little lower until they update. Columns are added
-- at the end, so older apps that read by name carry on.

-- ---------------------------------------------------------------------------
-- rpc_friend_prs: BW in place of a weight on bodyweight and assisted exercises.
-- Postgres won't let `create or replace` change a function's columns, so the
-- old definition is dropped first, and the grants set again after.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_prs(uuid);

-- True for a set whose weight gives its owner's bodyweight away: logged with
-- the BW button, with added weight or assistance, or on a bodyweight or
-- assisted exercise. The same test rpc_friend_prs marks BW with.
create schema if not exists private;
create or replace function private.reveals_bodyweight(s sets)
returns boolean
language sql
stable
set search_path = public
as $$
  select s.is_bodyweight
      or s.assist_weight is not null
      or s.added_weight is not null
      or exists (
        select 1 from exercises e
        where e.id = s.exercise_id and e.load_type in ('bodyweight', 'assisted')
      )
$$;
revoke all on function private.reveals_bodyweight(sets) from public, anon, authenticated;

create or replace function rpc_friend_prs(target uuid)
returns table (
  exercise_name text,
  best_weight   double precision,
  best_reps     int,
  best_e1rm     double precision,
  bodyweight    boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if target <> auth.uid() and not are_friends(auth.uid(), target) then
    raise exception 'not friends';
  end if;

  return query
  select
    x.ex_name,
    case when x.uses_bw and target <> auth.uid() then null else x.w_best end,
    x.r_best,
    case when x.uses_bw and target <> auth.uid() then null else x.e_best end,
    x.uses_bw
  from (
    select
      e.name                 as ex_name,
      max(s.weight)::float8  as w_best,
      max(s.reps)::int       as r_best,
      max(s.e1rm)::float8    as e_best,
      bool_or(
        e.load_type in ('bodyweight', 'assisted')
        or s.is_bodyweight
        or s.assist_weight is not null
        or s.added_weight is not null
      )                      as uses_bw
    from sets s
    join exercises e on e.id = s.exercise_id
    where s.user_id = target and s.is_warmup = false
    group by e.name
  ) x;
end $$;

revoke all on function rpc_friend_prs(uuid) from public, anon;
grant execute on function rpc_friend_prs(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_friend_stats: as in 0036, with strength_score added at the end.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_stats(uuid, date);

create or replace function rpc_friend_stats(target uuid, p_today date default current_date)
returns table (
  user_id            uuid,
  username           text,
  display_name       text,
  total_workouts     bigint,
  total_volume       double precision,
  total_reps         bigint,
  total_sets         bigint,
  total_seconds      bigint,
  workout_dates      text[],
  activity_seconds   bigint,
  activity_count     bigint,
  activity_kinds     bigint,
  friend_count       bigint,
  current_streak     int,
  best_streak        int,
  consistency_30     int,
  run_distance_m     double precision,
  steps_total        bigint,
  reactions_received bigint,
  featured_trophies  text[],
  unit               text,
  strength_score     double precision
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if target <> auth.uid() and not are_friends(auth.uid(), target) then
    raise exception 'not friends';
  end if;

  return query
  select
    p.user_id,
    p.username,
    p.display_name,
    coalesce(w.total_workouts, 0),
    coalesce(st.volume, 0)::float8,
    coalesce(st.total_reps, 0),
    coalesce(st.total_sets, 0),
    coalesce(w.total_seconds, 0),
    coalesce(w.dates, array[]::text[]),
    coalesce(a.total_seconds, 0),
    coalesce(a.total_activities, 0),
    coalesce(a.distinct_kinds, 0),
    coalesce(f.friend_count, 0),
    ss.current_streak,
    ss.best_streak,
    ss.consistency_30,
    coalesce(a.run_metres, 0)::float8,
    case when p.share_steps
      then coalesce((select sum(d.steps) from daily_steps d where d.user_id = p.user_id), 0)::bigint
    end,
    reactions_received(p.user_id),
    p.featured_trophies,
    p.unit::text,
    -- The sum of their best estimated max on each exercise, the figure their
    -- own phone scores XP from. A friend's total leaves out the exercises
    -- shown to them as BW, or it would give the bodyweight away.
    coalesce((
      select sum(b.best)
      from (
        select max(s2.e1rm) as best
        from sets s2
        join exercises e2 on e2.id = s2.exercise_id
        where s2.user_id = p.user_id and s2.is_warmup = false
        group by lower(e2.name)
        having target = auth.uid() or not bool_or(private.reveals_bodyweight(s2))
      ) b
      where b.best > 0
    ), 0)::float8
  from profiles p
  -- Workouts on their own: joining sets here is what multiplied the time.
  left join lateral (
    select
      count(*) filter (where wo.ended_at is not null)::bigint as total_workouts,
      sum(extract(epoch from (wo.ended_at - wo.started_at)))
        filter (where wo.ended_at is not null)::bigint        as total_seconds,
      array_agg(distinct to_char(wo.started_at, 'YYYY-MM-DD'))
        filter (where wo.ended_at is not null)                as dates
    from workouts wo
    where wo.user_id = p.user_id
  ) w on true
  left join lateral (
    select
      sum(s.weight * s.reps)
        filter (where target = auth.uid() or not private.reveals_bodyweight(s)) as volume,
      sum(s.reps)::bigint     as total_reps,
      count(*)::bigint        as total_sets
    from sets s
    where s.user_id = p.user_id
  ) st on true
  left join lateral (
    select
      sum(ac.duration_seconds)::bigint as total_seconds,
      count(*)::bigint                 as total_activities,
      count(distinct ac.kind)::bigint  as distinct_kinds,
      sum(run_metres(ac)) filter (where ac.kind = 'run') as run_metres
    from activities ac
    where ac.user_id = p.user_id
  ) a on true
  left join lateral (
    select count(*)::bigint as friend_count
    from friendships fr
    where fr.status = 'accepted'
      and (fr.requester_id = p.user_id or fr.addressee_id = p.user_id)
  ) f on true
  cross join lateral streak_stats(p.user_id, p_today) ss
  where p.user_id = target;
end $$;

revoke all on function rpc_friend_stats(uuid, date) from public, anon;
grant execute on function rpc_friend_stats(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- private.feed_posts: as in 0035, with a friend's session volume leaving out
-- bodyweight sets.
-- ---------------------------------------------------------------------------
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
      sum(s.weight * s.reps)
        filter (where w.user_id = auth.uid() or not private.reveals_bodyweight(s)) as volume,
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
-- rpc_friend_leaderboard: as in 0024, with a friend's weight lifted leaving
-- out bodyweight sets.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_leaderboard(timestamptz, date);

create or replace function rpc_friend_leaderboard(
  p_since timestamptz default null,
  p_today date default current_date
)
returns table (
  user_id          uuid,
  username         text,
  display_name     text,
  unit             weight_unit,
  is_me            boolean,
  total_volume     double precision,
  workout_seconds  bigint,
  activity_seconds bigint,
  current_streak   int,
  consistency_30   int,
  run_distance_m   double precision,
  steps            bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with people as (
    select auth.uid() as id
    union
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
    from friendships f
    where f.status = 'accepted'
      and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  )
  select
    p.user_id,
    p.username,
    p.display_name,
    p.unit,
    p.user_id = auth.uid(),
    coalesce(v.volume, 0)::float8,
    coalesce(t.seconds, 0)::bigint,
    coalesce(a.seconds, 0)::bigint,
    ss.current_streak,
    ss.consistency_30,
    coalesce(a.run_metres, 0)::float8,
    case when p.share_steps then coalesce(ds.steps, 0)::bigint end
  from people
  join profiles p on p.user_id = people.id
  left join lateral (
    select sum(s.weight * s.reps)
             filter (where p.user_id = auth.uid() or not private.reveals_bodyweight(s)) as volume
    from sets s
    join workouts wo on wo.id = s.workout_id
    where s.user_id = p.user_id
      and wo.ended_at is not null
      and (p_since is null or wo.started_at >= p_since)
  ) v on true
  left join lateral (
    select sum(extract(epoch from (wo.ended_at - wo.started_at))) as seconds
    from workouts wo
    where wo.user_id = p.user_id
      and wo.ended_at is not null
      and (p_since is null or wo.started_at >= p_since)
  ) t on true
  left join lateral (
    select
      sum(ac.duration_seconds) as seconds,
      sum(run_metres(ac)) filter (where ac.kind = 'run') as run_metres
    from activities ac
    where ac.user_id = p.user_id
      and (p_since is null or ac.performed_at >= p_since)
  ) a on true
  left join lateral (
    select sum(d.steps) as steps
    from daily_steps d
    where d.user_id = p.user_id
      and (p_since is null or d.day >= (p_since at time zone 'utc')::date)
  ) ds on true
  cross join lateral streak_stats(p.user_id, p_today) ss
  where auth.uid() is not null;
$$;

revoke all on function rpc_friend_leaderboard(timestamptz, date) from public, anon;
grant execute on function rpc_friend_leaderboard(timestamptz, date) to authenticated;
