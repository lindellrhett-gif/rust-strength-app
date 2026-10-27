-- 0020_streaks_count_activities.sql
--
-- *** APPLY WHEN VERSION 1.1 IS RELEASED, NOT BEFORE. ***
--
-- Every activity now counts toward the streak, not just finished workouts:
-- a run, a game of basketball or a long walk keeps a streak going, the same
-- as a lifting session. (Decided with running: "all activities count".)
--
-- streak_stats feeds friends' streaks and consistency on the leaderboard
-- and friend profiles. The app works out your own streak on the phone, and
-- version 1.0 counts workouts only there. Applied early, friends would see
-- your streak counting activities while your own screen didn't. Applied
-- with the 1.1 release, both agree: 1.1 counts activities on the phone too
-- (useTrainedDates in src/data/stats.ts).
--
-- Same dates as before (the UTC day of each session), same rules: rest days
-- bridge a streak without counting as trained days, and a streak alive
-- yesterday is still alive today.

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
      select (a.performed_at at time zone 'utc')::date, true
      from activities a
      where a.user_id = p_user
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

revoke all on function streak_stats(uuid, date) from public, anon, authenticated;
