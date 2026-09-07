-- Gym App — Milestone 2
-- Bodyweight support, workout duration, planned sessions (calendar),
-- friends/social, and equipment tags for the workout generator.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type equipment_kind as enum (
    'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'bands'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type friend_status as enum ('pending', 'accepted');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- profiles: bodyweight + the equipment the user usually has access to
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists body_weight double precision
  check (body_weight is null or body_weight > 0);
alter table profiles add column if not exists equipment equipment_kind[] not null default '{}';

-- ---------------------------------------------------------------------------
-- sets: mark a set as bodyweight-loaded
-- ---------------------------------------------------------------------------
alter table sets add column if not exists is_bodyweight boolean not null default false;

-- ---------------------------------------------------------------------------
-- exercises: what equipment each movement needs (drives the generator)
-- ---------------------------------------------------------------------------
alter table exercises add column if not exists equipment equipment_kind;

-- Backfill the seed library from its names. Custom user exercises stay null
-- until the user edits them; the generator treats null as "always eligible".
update exercises set equipment = 'bodyweight'
  where equipment is null and user_id is null and (
    name ilike '%push-up%' or name ilike '%pull-up%' or name ilike '%dip%' or
    name ilike '%plank%' or name ilike '%hanging leg raise%' or name ilike '%ab wheel%');
update exercises set equipment = 'cable'
  where equipment is null and user_id is null and (
    name ilike '%cable%' or name ilike '%pushdown%' or name ilike '%pulldown%' or
    name ilike '%face pull%' or name ilike '%crossover%');
update exercises set equipment = 'machine'
  where equipment is null and user_id is null and (
    name ilike '%machine%' or name ilike '%leg press%' or name ilike '%hack squat%' or
    name ilike '%leg extension%' or name ilike '%leg curl%' or name ilike '%pec deck%' or
    name ilike '%chest-supported%' or name ilike '%glute kickback%' or
    name ilike '%calf raise%' or name ilike '%preacher%');
update exercises set equipment = 'dumbbell'
  where equipment is null and user_id is null and name ilike '%dumbbell%';
update exercises set equipment = 'barbell' where equipment is null and user_id is null;

-- ---------------------------------------------------------------------------
-- planned_sessions: future workouts placed on the calendar
-- Kept separate from `workouts` so the "one open workout" index still holds.
-- ---------------------------------------------------------------------------
create table if not exists planned_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  scheduled_for date not null,
  title         text not null default 'Workout',
  note          text,
  completed_workout_id uuid references workouts (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists planned_user_date_idx on planned_sessions (user_id, scheduled_for);

-- ---------------------------------------------------------------------------
-- friendships: one row per pair, either party may see it
-- ---------------------------------------------------------------------------
create table if not exists friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       friend_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
-- One relationship per unordered pair, regardless of who asked first.
create unique index if not exists friendships_unique_pair
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on friendships (addressee_id, status);
create index if not exists friendships_requester_idx on friendships (requester_id, status);

-- True when the two users have an accepted friendship.
create or replace function are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table planned_sessions enable row level security;
alter table friendships      enable row level security;

drop policy if exists planned_all_own      on planned_sessions;
drop policy if exists friendships_select   on friendships;
drop policy if exists friendships_insert   on friendships;
drop policy if exists friendships_update   on friendships;
drop policy if exists friendships_delete   on friendships;
drop policy if exists profiles_select_own  on profiles;
drop policy if exists profiles_select_self_or_friend on profiles;

create policy planned_all_own on planned_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Either side of a friendship row can read it.
create policy friendships_select on friendships
  for select using (requester_id = auth.uid() or addressee_id = auth.uid());
-- You may only create requests as yourself.
create policy friendships_insert on friendships
  for insert with check (requester_id = auth.uid());
-- The addressee accepts; either side may modify their own row afterwards.
create policy friendships_update on friendships
  for update using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_delete on friendships
  for delete using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Profiles are readable by their owner, by accepted friends, and by anyone
-- already in a pending request with them (so requests show a name).
create policy profiles_select_self_or_friend on profiles
  for select using (
    user_id = auth.uid()
    or are_friends(auth.uid(), user_id)
    or exists (
      select 1 from friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = profiles.user_id)
         or (f.addressee_id = auth.uid() and f.requester_id = profiles.user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Stats: add total training time to the all-time totals
-- ---------------------------------------------------------------------------
-- Aggregated in separate CTEs: joining sets to workouts first would repeat each
-- workout's duration once per set.
drop view if exists v_all_time_totals;
create view v_all_time_totals
with (security_invoker = true) as
with set_totals as (
  select
    user_id,
    coalesce(sum(weight * reps), 0)::float8 as volume,
    coalesce(sum(reps), 0)::bigint          as total_reps,
    count(*)::bigint                        as total_sets
  from sets
  group by user_id
),
workout_totals as (
  select
    user_id,
    count(*) filter (where ended_at is not null)::bigint as total_workouts,
    coalesce(sum(extract(epoch from (ended_at - started_at)))
      filter (where ended_at is not null), 0)::bigint    as total_seconds
  from workouts
  group by user_id
)
select
  coalesce(w.user_id, s.user_id)   as user_id,
  coalesce(s.volume, 0)::float8    as volume,
  coalesce(s.total_reps, 0)::bigint as total_reps,
  coalesce(s.total_sets, 0)::bigint as total_sets,
  coalesce(w.total_workouts, 0)::bigint as total_workouts,
  coalesce(w.total_seconds, 0)::bigint  as total_seconds
from workout_totals w
full outer join set_totals s on s.user_id = w.user_id;

-- ---------------------------------------------------------------------------
-- Search users to add as friends (username prefix, excludes self).
-- SECURITY DEFINER so it can look past the profiles RLS policy, but it only
-- ever returns a username + display name — never training data.
-- ---------------------------------------------------------------------------
create or replace function rpc_search_users(q text)
returns table (user_id uuid, username text, display_name text)
language sql
security definer
set search_path = public
stable
as $$
  select p.user_id, p.username, p.display_name
  from profiles p
  where p.user_id <> auth.uid()
    and length(coalesce(q, '')) >= 2
    and p.username ilike (q || '%')
  order by p.username
  limit 20;
$$;

-- ---------------------------------------------------------------------------
-- A friend's headline stats. SECURITY DEFINER, but it checks friendship first
-- and returns aggregates only — never individual sets.
-- ---------------------------------------------------------------------------
create or replace function rpc_friend_stats(target uuid)
returns table (
  user_id        uuid,
  username       text,
  display_name   text,
  total_workouts bigint,
  total_volume   double precision,
  total_reps     bigint,
  total_sets     bigint,
  total_seconds  bigint,
  workout_dates  date[]
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
    (select count(*) from workouts w where w.user_id = target and w.ended_at is not null),
    (select coalesce(sum(s.weight * s.reps), 0)::float8 from sets s where s.user_id = target),
    (select coalesce(sum(s.reps), 0)::bigint from sets s where s.user_id = target),
    (select count(*)::bigint from sets s where s.user_id = target),
    (select coalesce(sum(extract(epoch from (w.ended_at - w.started_at))), 0)::bigint
       from workouts w where w.user_id = target and w.ended_at is not null),
    (select coalesce(array_agg(distinct w.started_at::date), '{}')
       from workouts w where w.user_id = target and w.ended_at is not null)
  from profiles p
  where p.user_id = target;
end $$;
