-- Gym App — Milestone 1 schema
-- Core logging loop + stats. Social / calendar / AI-workout tables come later.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type muscle_group as enum (
    'chest', 'back', 'shoulders', 'biceps', 'triceps',
    'quads', 'hamstrings', 'glutes', 'calves', 'core'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type weight_unit as enum ('lb', 'kg');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  username        text not null,
  display_name    text,
  unit            weight_unit not null default 'lb',
  target_rep_low  int not null default 6 check (target_rep_low between 1 and 30),
  target_rep_high int not null default 8 check (target_rep_high between 1 and 30),
  created_at      timestamptz not null default now(),
  check (target_rep_low <= target_rep_high)
);
create unique index if not exists profiles_username_lower_idx on profiles (lower(username));

-- Auto-create a profile row when a user signs up. Username defaults to the part
-- of the email before "@", de-duplicated with a short random suffix if needed.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  candidate text;
begin
  base_name := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if base_name is null or length(base_name) = 0 then
    base_name := 'lifter';
  end if;
  candidate := base_name;
  while exists (select 1 from profiles where username = candidate) loop
    candidate := base_name || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into profiles (user_id, username, display_name)
  values (new.id, candidate, base_name);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- gyms
-- ---------------------------------------------------------------------------
create table if not exists gyms (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists gyms_user_idx on gyms (user_id);

-- ---------------------------------------------------------------------------
-- machines  (a labeled piece of equipment, optionally at a gym)
-- ---------------------------------------------------------------------------
create table if not exists machines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  gym_id     uuid references gyms (id) on delete set null,
  label      text not null,
  increment  real not null default 5 check (increment > 0),
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists machines_user_idx on machines (user_id);

-- ---------------------------------------------------------------------------
-- exercises  (user_id null == shared seed library)
-- ---------------------------------------------------------------------------
create table if not exists exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users (id) on delete cascade,
  name         text not null,
  muscle_group muscle_group not null,
  is_custom    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists exercises_user_idx on exercises (user_id);
-- One custom exercise name per user; one library name globally.
create unique index if not exists exercises_unique_user_name
  on exercises (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- ---------------------------------------------------------------------------
-- workouts  (a training session; ended_at null == in progress)
-- ---------------------------------------------------------------------------
create table if not exists workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_started_idx on workouts (user_id, started_at desc);
-- At most one open workout per user.
create unique index if not exists workouts_one_open_per_user
  on workouts (user_id) where ended_at is null;

-- ---------------------------------------------------------------------------
-- sets
-- ---------------------------------------------------------------------------
create table if not exists sets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  workout_id      uuid not null references workouts (id) on delete cascade,
  exercise_id     uuid not null references exercises (id),
  machine_id      uuid references machines (id) on delete set null,
  -- float8 (not numeric) so PostgREST returns JSON numbers, not strings.
  weight          double precision not null check (weight >= 0),
  reps            int not null check (reps > 0),
  rpe             real check (rpe between 5.0 and 10.0),
  is_warmup       boolean not null default false,
  target_rep_low  int not null default 6,
  target_rep_high int not null default 8,
  e1rm            double precision not null default 0,
  order_index     int not null default 0,
  performed_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists sets_workout_idx on sets (workout_id, order_index);
create index if not exists sets_user_exercise_idx on sets (user_id, exercise_id, performed_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table gyms     enable row level security;
alter table machines enable row level security;
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table sets     enable row level security;

-- Dropped first so this whole file stays safe to re-run.
drop policy if exists profiles_select_own    on profiles;
drop policy if exists profiles_update_own    on profiles;
drop policy if exists gyms_all_own           on gyms;
drop policy if exists machines_all_own       on machines;
drop policy if exists workouts_all_own       on workouts;
drop policy if exists sets_all_own           on sets;
drop policy if exists exercises_select       on exercises;
drop policy if exists exercises_insert_own   on exercises;
drop policy if exists exercises_update_own   on exercises;
drop policy if exists exercises_delete_own   on exercises;

-- profiles: a user reads/updates only their own row (friend reads added later).
create policy profiles_select_own on profiles for select using (user_id = auth.uid());
create policy profiles_update_own on profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Owner-only tables (identical shape).
create policy gyms_all_own on gyms
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy machines_all_own on machines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workouts_all_own on workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sets_all_own on sets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- exercises: everyone reads the shared library + their own; writes are own-only.
create policy exercises_select on exercises
  for select using (user_id is null or user_id = auth.uid());
create policy exercises_insert_own on exercises
  for insert with check (user_id = auth.uid());
create policy exercises_update_own on exercises
  for update using (user_id = auth.uid());
create policy exercises_delete_own on exercises
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Stats views + RPC  (security_invoker so table RLS still applies)
-- ---------------------------------------------------------------------------
create or replace view v_exercise_prs
with (security_invoker = true) as
select
  s.user_id,
  s.exercise_id,
  e.name             as exercise_name,
  e.muscle_group,
  max(s.e1rm)::float8            as best_e1rm,
  max(s.weight)::float8          as best_weight,
  max(s.weight * s.reps)::float8 as best_set_volume
from sets s
join exercises e on e.id = s.exercise_id
where s.is_warmup = false
group by s.user_id, s.exercise_id, e.name, e.muscle_group;

create or replace view v_all_time_totals
with (security_invoker = true) as
select
  w.user_id,
  coalesce(sum(s.weight * s.reps), 0)::float8        as volume,
  coalesce(sum(s.reps), 0)::bigint                   as total_reps,
  count(s.id)                                        as total_sets,
  count(distinct w.id) filter (where w.ended_at is not null) as total_workouts
from workouts w
left join sets s on s.workout_id = w.id
group by w.user_id;

-- Set counts per muscle group for the ISO week starting `week_start`.
create or replace function rpc_weekly_coverage(week_start date)
returns table (muscle_group muscle_group, set_count bigint)
language sql
security invoker
stable
as $$
  select e.muscle_group, count(*)::bigint
  from sets s
  join exercises e on e.id = s.exercise_id
  where s.user_id = auth.uid()
    and s.is_warmup = false
    and s.performed_at >= week_start
    and s.performed_at < (week_start + 7)
  group by e.muscle_group;
$$;
