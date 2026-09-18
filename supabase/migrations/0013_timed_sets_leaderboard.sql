-- Rust Strength — timed sets, a higher rep cap, and the friends leaderboard.
--
-- Run 0012 first: this script uses the 'timed' load type it adds.
--
--   1. Sets can record a duration. A timed set (a plank) is one hold of
--      duration_seconds, stored with reps = 1 and weight = any weight added
--      on top (a plate on the back), usually 0. So a hold adds nothing to
--      volume, and every existing stat query stays correct.
--   2. Rep targets can go up to 200, for high-rep bodyweight work.
--   3. Planks and other holds become timed, and more holds join the catalog.
--   4. rpc_friend_leaderboard: the signed-in user and their accepted friends,
--      with the same totals a friend's profile already shows.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Duration on sets
-- ---------------------------------------------------------------------------
alter table sets add column if not exists duration_seconds int
  check (duration_seconds is null or duration_seconds between 1 and 86400);

-- ---------------------------------------------------------------------------
-- 2. Rep targets up to 200 (was 30)
-- ---------------------------------------------------------------------------
alter table profiles drop constraint if exists profiles_target_rep_low_check;
alter table profiles drop constraint if exists profiles_target_rep_high_check;
alter table profiles add constraint profiles_target_rep_low_check
  check (target_rep_low between 1 and 200);
alter table profiles add constraint profiles_target_rep_high_check
  check (target_rep_high between 1 and 200);

-- ---------------------------------------------------------------------------
-- 3. Timed exercises
-- ---------------------------------------------------------------------------
insert into exercises (name, muscle_group, equipment, load_type)
select v.name, v.muscle_group::muscle_group, v.equipment::equipment_kind, v.load_type::exercise_load_type
from (values
  ('Hollow Body Hold',                 'core',       'bodyweight', 'timed'),
  ('Reverse Plank',                    'core',       'bodyweight', 'timed'),
  ('Bear Plank',                       'core',       'bodyweight', 'timed'),
  ('Copenhagen Plank',                 'core',       'bodyweight', 'timed'),
  ('Weighted Plank',                   'core',       'bodyweight', 'timed'),
  ('L-Sit',                            'core',       'bodyweight', 'timed'),
  ('Superman Hold',                    'back',       'bodyweight', 'timed'),
  ('Dead Hang',                        'back',       'bodyweight', 'timed'),
  ('Flexed-Arm Hang',                  'back',       'bodyweight', 'timed'),
  ('Front Lever Hold',                 'back',       'bodyweight', 'timed'),
  ('Wall Sit',                         'quads',      'bodyweight', 'timed'),
  ('Split Squat Hold',                 'quads',      'bodyweight', 'timed'),
  ('Glute Bridge Hold',                'glutes',     'bodyweight', 'timed'),
  ('Handstand Hold',                   'shoulders',  'bodyweight', 'timed'),
  ('Calf Raise Hold',                  'calves',     'bodyweight', 'timed'),
  ('Farmer''s Hold',                   'core',       'dumbbell',   'timed')
) as v(name, muscle_group, equipment, load_type)
on conflict do nothing;

-- Planks were bodyweight in 0011. Library rows only; custom exercises are
-- left alone.
update exercises
set load_type = 'timed'
where user_id is null and lower(name) in ('plank', 'side plank');

-- ---------------------------------------------------------------------------
-- 4. Friends leaderboard
--
-- One row for the caller and one for each accepted friend. Each figure is one
-- a friend's profile already shows through rpc_friend_stats, so this reveals
-- nothing new to anyone; it saves the app one request per friend. The weight
-- unit comes along so totals logged in kg and lb can be compared fairly.
--
-- p_since limits volume, workout time and activity time to a window (null =
-- all time). Streaks and consistency need the full list of training days, so
-- workout_dates is never limited.
-- ---------------------------------------------------------------------------
create or replace function rpc_friend_leaderboard(p_since timestamptz default null)
returns table (
  user_id          uuid,
  username         text,
  display_name     text,
  unit             weight_unit,
  is_me            boolean,
  total_volume     double precision,
  workout_seconds  bigint,
  activity_seconds bigint,
  workout_dates    text[]
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
    coalesce(d.dates, array[]::text[])
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
  left join lateral (
    select array_agg(distinct to_char(wo.started_at, 'YYYY-MM-DD')) as dates
    from workouts wo
    where wo.user_id = p.user_id and wo.ended_at is not null
  ) d on true
  where auth.uid() is not null;
$$;

revoke all on function rpc_friend_leaderboard(timestamptz) from public;
grant execute on function rpc_friend_leaderboard(timestamptz) to authenticated;
