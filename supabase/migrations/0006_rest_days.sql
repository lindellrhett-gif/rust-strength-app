-- Gym App — Milestone 6
--
--   * rest_days: a deliberate day off. Planning one and logging one are the
--     same row — the date decides whether it reads as upcoming or taken.
--     A rest day bridges your streak instead of breaking it.
--   * workouts.name: so the recent list can say "Push Day 1" rather than a bare
--     date. Captured at start time, so renaming a preset later does not rewrite
--     history.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- workouts get a name, taken from the preset (or generator) that started them
-- ---------------------------------------------------------------------------
alter table workouts add column if not exists name text;

-- ---------------------------------------------------------------------------
-- rest_days
-- ---------------------------------------------------------------------------
create table if not exists rest_days (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  rest_date  date not null,
  note       text,
  created_at timestamptz not null default now()
);
-- One rest day per date; re-marking the same day is a no-op, not a duplicate.
create unique index if not exists rest_days_unique_day
  on rest_days (user_id, rest_date);
create index if not exists rest_days_user_idx on rest_days (user_id, rest_date desc);

alter table rest_days enable row level security;
drop policy if exists rest_days_all_own on rest_days;
create policy rest_days_all_own on rest_days
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Starting from a preset now stamps the workout with the preset's name.
-- ---------------------------------------------------------------------------
create or replace function rpc_start_workout_from_template(p_template_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_workout_id uuid;
  v_name text;
begin
  select name into v_name
  from workout_templates
  where id = p_template_id and user_id = auth.uid();

  if v_name is null then
    raise exception 'template not found';
  end if;

  select id into v_workout_id
  from workouts
  where user_id = auth.uid() and ended_at is null
  limit 1;

  if v_workout_id is null then
    insert into workouts (user_id, name) values (auth.uid(), v_name)
    returning id into v_workout_id;
  else
    -- Resuming an unnamed open session: adopt the preset's name.
    update workouts set name = coalesce(name, v_name) where id = v_workout_id;
  end if;

  insert into workout_exercises
    (user_id, workout_id, exercise_id, order_index, target_sets, target_rep_low, target_rep_high)
  select auth.uid(), v_workout_id, te.exercise_id, te.order_index,
         te.target_sets, te.target_rep_low, te.target_rep_high
  from template_exercises te
  where te.template_id = p_template_id
  on conflict (workout_id, exercise_id) do nothing;

  return v_workout_id;
end $$;
