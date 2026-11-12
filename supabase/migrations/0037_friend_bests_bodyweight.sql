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
--    worked out from. One total in place of the per-exercise numbers keeps a
--    friend's level matching their own.
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
    -- The sum of their best estimated max on each exercise, the same figure
    -- their own phone scores XP from. Sent as one total, so the level still
    -- matches without sending a bodyweight exercise's number on its own.
    coalesce((
      select sum(b.best)
      from (
        select max(s2.e1rm) as best
        from sets s2
        join exercises e2 on e2.id = s2.exercise_id
        where s2.user_id = p.user_id and s2.is_warmup = false
        group by lower(e2.name)
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
      sum(s.weight * s.reps)  as volume,
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
