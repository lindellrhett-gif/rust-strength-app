-- Gym App — Milestone 5
--
--   * activities: non-lifting training (running, stair master, basketball...)
--     timed live or entered by hand, with optional distance/steps/calories.
--   * rpc_workout_summary: what the post-workout screen shows, including which
--     lifts were personal records.
--
-- Cancelling a workout needs no schema: deleting the row already cascades to
-- its sets and planned exercises.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type activity_kind as enum (
    'run', 'walk', 'hike', 'cycle', 'swim', 'row',
    'stairmaster', 'elliptical', 'jump_rope',
    'basketball', 'soccer', 'tennis', 'boxing', 'climbing',
    'yoga', 'other'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create table if not exists activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  kind             activity_kind not null default 'other',
  /** Free-text label, e.g. "5-a-side" — falls back to the kind's name. */
  name             text,
  performed_at     timestamptz not null default now(),
  /** Source of truth for time, whether timed live or typed in. */
  duration_seconds int not null check (duration_seconds >= 0 and duration_seconds < 86400 * 2),
  /** Everything below is optional — most activities record none of it. */
  distance         double precision check (distance is null or distance >= 0),
  distance_unit    text check (distance_unit is null or distance_unit in ('mi', 'km', 'm')),
  steps            int check (steps is null or steps >= 0),
  calories         int check (calories is null or calories >= 0),
  note             text,
  created_at       timestamptz not null default now()
);
create index if not exists activities_user_time_idx
  on activities (user_id, performed_at desc);

alter table activities enable row level security;
drop policy if exists activities_all_own on activities;
create policy activities_all_own on activities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lifetime activity totals, mirroring v_all_time_totals for lifting.
-- ---------------------------------------------------------------------------
create or replace view v_activity_totals
with (security_invoker = true) as
select
  user_id,
  coalesce(sum(duration_seconds), 0)::bigint as total_seconds,
  count(*)::bigint                           as total_activities,
  count(distinct kind)::bigint               as distinct_kinds
from activities
group by user_id;

-- ---------------------------------------------------------------------------
-- Post-workout summary: per-exercise bests for this session next to the
-- user's best BEFORE it, so the screen can call out genuine PRs.
-- ---------------------------------------------------------------------------
create or replace function rpc_workout_summary(p_workout_id uuid)
returns table (
  exercise_id      uuid,
  exercise_name    text,
  working_sets     int,
  volume           double precision,
  best_weight      double precision,
  best_reps        int,
  best_e1rm        double precision,
  prev_best_weight double precision,
  prev_best_e1rm   double precision,
  is_weight_pr     boolean,
  is_e1rm_pr       boolean
)
language plpgsql
security invoker
stable
as $$
declare
  v_started_at timestamptz;
  v_user_id uuid;
begin
  select w.started_at, w.user_id into v_started_at, v_user_id
  from workouts w where w.id = p_workout_id;

  if v_user_id is null or v_user_id <> auth.uid() then
    raise exception 'workout not found';
  end if;

  return query
  with this_session as (
    select
      s.exercise_id,
      count(*)::int                          as working_sets,
      coalesce(sum(s.weight * s.reps), 0)::float8 as volume,
      max(s.weight)::float8                  as best_weight,
      max(s.reps)::int                       as best_reps,
      max(s.e1rm)::float8                    as best_e1rm
    from sets s
    where s.workout_id = p_workout_id and s.is_warmup = false
    group by s.exercise_id
  ),
  before as (
    -- Everything logged before this session started, so a PR is measured
    -- against history rather than against the same workout.
    select
      s.exercise_id,
      max(s.weight)::float8 as prev_best_weight,
      max(s.e1rm)::float8   as prev_best_e1rm
    from sets s
    where s.user_id = v_user_id
      and s.is_warmup = false
      and s.workout_id <> p_workout_id
      and s.performed_at < v_started_at
    group by s.exercise_id
  )
  select
    t.exercise_id,
    e.name,
    t.working_sets,
    t.volume,
    t.best_weight,
    t.best_reps,
    t.best_e1rm,
    b.prev_best_weight,
    b.prev_best_e1rm,
    (b.prev_best_weight is null or t.best_weight > b.prev_best_weight) as is_weight_pr,
    (b.prev_best_e1rm is null or t.best_e1rm > b.prev_best_e1rm)       as is_e1rm_pr
  from this_session t
  join exercises e on e.id = t.exercise_id
  left join before b on b.exercise_id = t.exercise_id
  order by t.volume desc;
end $$;

-- ---------------------------------------------------------------------------
-- rpc_friend_stats gains activity totals, so a friend's activity trophies
-- render correctly instead of always reading zero.
--
-- The return signature changes, and Postgres will not let `create or replace`
-- alter a function's OUT columns, so the old one is dropped first.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_stats(uuid);

create function rpc_friend_stats(target uuid)
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
  activity_kinds    bigint
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
    coalesce(w.volume, 0)::float8,
    coalesce(w.total_reps, 0),
    coalesce(w.total_sets, 0),
    coalesce(w.total_seconds, 0),
    coalesce(w.dates, array[]::text[]),
    coalesce(a.total_seconds, 0),
    coalesce(a.total_activities, 0),
    coalesce(a.distinct_kinds, 0)
  from profiles p
  left join lateral (
    select
      count(distinct wo.id) filter (where wo.ended_at is not null) as total_workouts,
      sum(s.weight * s.reps)                                      as volume,
      sum(s.reps)::bigint                                         as total_reps,
      count(s.id)::bigint                                         as total_sets,
      sum(
        extract(epoch from (wo.ended_at - wo.started_at))
      ) filter (where wo.ended_at is not null)::bigint            as total_seconds,
      array_agg(distinct to_char(wo.started_at, 'YYYY-MM-DD'))
        filter (where wo.ended_at is not null)                    as dates
    from workouts wo
    left join sets s on s.workout_id = wo.id
    where wo.user_id = p.user_id
  ) w on true
  left join lateral (
    select
      sum(ac.duration_seconds)::bigint as total_seconds,
      count(*)::bigint                 as total_activities,
      count(distinct ac.kind)::bigint  as distinct_kinds
    from activities ac
    where ac.user_id = p.user_id
  ) a on true
  where p.user_id = target;
end $$;
