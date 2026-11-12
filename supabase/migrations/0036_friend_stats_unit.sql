-- 0036_friend_stats_unit.sql
--
-- rpc_friend_stats gains a last column, unit: the unit the friend logs in. Their
-- totals and bests are stored in it, and the friend profile read them as if they
-- were in the viewer's unit, so a kg lifter's 8,000 read as 8,000 lb, and their
-- trophies and level were scored from it as if those were pounds.
--
-- Nothing new is shared: rpc_friend_leaderboard already gives each friend's unit.
-- rpc_friend_prs stays as it is. Its bests are the same person's, in the same
-- unit, so the app reads the unit once, from here.
--
-- Additive: the column goes at the end, and older apps read by name, so they
-- carry on as they were. Safe to apply before 1.2 ships. Until it is applied, 1.2
-- leaves a friend's numbers unconverted, as 1.1 does.

-- ---------------------------------------------------------------------------
-- rpc_friend_stats: as in 0024, with unit added at the end.
--
-- Postgres will not let `create or replace` change a function's OUT columns, so
-- the old definition is dropped first, and the grants set again after.
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
  unit               text
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
    p.unit::text
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
