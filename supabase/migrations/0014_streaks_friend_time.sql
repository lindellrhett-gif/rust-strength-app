-- Rust Strength — rest-aware streaks for friends, and a fix to friends'
-- workout time.
--
--   1. Friends' total workout time read far too high. rpc_friend_stats summed
--      each workout's length once per set in it (workouts were joined to sets
--      before summing), so a one-hour session with 20 sets counted as 20 hours.
--      Workout time is now summed over workouts alone.
--
--   2. Rest days keep a streak alive and count toward consistency, but only
--      training days add to the streak's length. Friends' profiles and the
--      leaderboard need that too, yet a friend's rest days are private. So
--      the server works out each person's current streak, best streak and
--      30-day consistency itself and returns only the numbers: the rest days
--      never leave the database.
--
-- Safe to re-run. Run after 0013.

-- ---------------------------------------------------------------------------
-- The streak rules, in one place.
--
-- A covered day is one with a finished workout or a rest day. A run is
-- consecutive covered days; its length is the training days in it. The current
-- streak is the run that reaches today or yesterday (so it does not break
-- before today's session). Consistency is covered days in the last 30, out of
-- 30. Future rest days (planned ahead) are ignored.
--
-- Training days are UTC calendar days. The app computes your own streak from
-- your local dates; for friends the server's day is used.
-- ---------------------------------------------------------------------------
create or replace function streak_stats(p_user uuid, p_today date)
returns table (current_streak int, best_streak int, consistency_30 int)
language sql
stable
set search_path = public
as $$
  with covered as (
    select d, bool_or(trained) as trained
    from (
      select (wo.started_at at time zone 'utc')::date as d, true as trained
      from workouts wo
      where wo.user_id = p_user and wo.ended_at is not null
      union all
      select r.rest_date, false
      from rest_days r
      where r.user_id = p_user
    ) x
    where d <= p_today
    group by d
  ),
  islands as (
    select d, trained, d - (row_number() over (order by d))::int as grp
    from covered
  ),
  runs as (
    select min(d) as start_d, max(d) as end_d,
           count(*) filter (where trained)::int as trained_days
    from islands
    group by grp
  )
  select
    coalesce((select r.trained_days from runs r where r.end_d >= p_today - 1), 0),
    coalesce((select max(r.trained_days) from runs r), 0),
    round(100.0 * (select count(*) from covered c where c.d > p_today - 30) / 30)::int;
$$;

-- Only the RPCs below call this. Called directly it would only ever see the
-- caller's own rows, but there is no reason to offer it.
revoke all on function streak_stats(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- rpc_friend_stats: correct workout time, plus rest-aware streak numbers.
-- p_today is the viewer's local date; it defaults so older app builds, which
-- send only `target`, keep working.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_stats(uuid);
drop function if exists rpc_friend_stats(uuid, date);

create function rpc_friend_stats(target uuid, p_today date default current_date)
returns table (
  user_id           uuid,
  username          text,
  display_name      text,
  total_workouts    bigint,
  total_volume      double precision,
  total_reps        bigint,
  total_sets        bigint,
  total_seconds     bigint,
  workout_dates     text[],
  activity_seconds  bigint,
  activity_count    bigint,
  activity_kinds    bigint,
  friend_count      bigint,
  current_streak    int,
  best_streak       int,
  consistency_30    int
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
    ss.consistency_30
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
      count(distinct ac.kind)::bigint  as distinct_kinds
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

revoke all on function rpc_friend_stats(uuid, date) from public;
grant execute on function rpc_friend_stats(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_friend_leaderboard: streak and consistency now come from the server with
-- rest days counted, instead of the list of training days.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_leaderboard(timestamptz);
drop function if exists rpc_friend_leaderboard(timestamptz, date);

create function rpc_friend_leaderboard(
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
  consistency_30   int
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
    ss.consistency_30
  from people
  join profiles p on p.user_id = people.id
  left join lateral (
    select sum(s.weight * s.reps) as volume
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
    select sum(ac.duration_seconds) as seconds
    from activities ac
    where ac.user_id = p.user_id
      and (p_since is null or ac.performed_at >= p_since)
  ) a on true
  cross join lateral streak_stats(p.user_id, p_today) ss
  where auth.uid() is not null;
$$;

revoke all on function rpc_friend_leaderboard(timestamptz, date) from public;
grant execute on function rpc_friend_leaderboard(timestamptz, date) to authenticated;
