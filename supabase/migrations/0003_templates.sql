-- Gym App — Milestone 3: workout presets (templates)
--
-- Adds a reusable list of exercises ("Push Day 1") that can be:
--   * built by hand,
--   * saved from a workout you just finished,
--   * attached to a day on the calendar,
--   * and expanded into exercise slots when the workout starts.
--
-- `workout_exercises` holds those slots on a live workout, so a session can
-- list its movements before a single set has been logged. The generator writes
-- the same rows, which is why generated workouts now arrive pre-populated.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- workout_templates
-- ---------------------------------------------------------------------------
create table if not exists workout_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists templates_user_idx on workout_templates (user_id, name);
-- One preset name per user.
create unique index if not exists templates_unique_user_name
  on workout_templates (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- template_exercises — the ordered movements inside a preset
-- ---------------------------------------------------------------------------
create table if not exists template_exercises (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references workout_templates (id) on delete cascade,
  exercise_id     uuid not null references exercises (id) on delete cascade,
  order_index     int not null default 0,
  target_sets     int not null default 3 check (target_sets between 1 and 20),
  target_rep_low  int not null default 6,
  target_rep_high int not null default 8,
  check (target_rep_low <= target_rep_high)
);
create index if not exists template_exercises_idx
  on template_exercises (template_id, order_index);

-- ---------------------------------------------------------------------------
-- workout_exercises — planned slots on an actual session
-- ---------------------------------------------------------------------------
create table if not exists workout_exercises (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  workout_id      uuid not null references workouts (id) on delete cascade,
  exercise_id     uuid not null references exercises (id) on delete cascade,
  order_index     int not null default 0,
  target_sets     int not null default 3,
  target_rep_low  int not null default 6,
  target_rep_high int not null default 8,
  /** Weight the generator suggested, if any — shown until a real set lands. */
  suggested_weight double precision,
  created_at      timestamptz not null default now()
);
create index if not exists workout_exercises_idx
  on workout_exercises (workout_id, order_index);
-- A movement appears once in a session's plan; revisits are just more sets.
create unique index if not exists workout_exercises_unique
  on workout_exercises (workout_id, exercise_id);

-- ---------------------------------------------------------------------------
-- Calendar plans can point at a preset
-- ---------------------------------------------------------------------------
alter table planned_sessions
  add column if not exists template_id uuid references workout_templates (id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table workout_templates enable row level security;
alter table template_exercises enable row level security;
alter table workout_exercises enable row level security;

drop policy if exists templates_all_own          on workout_templates;
drop policy if exists template_exercises_all_own on template_exercises;
drop policy if exists workout_exercises_all_own  on workout_exercises;

create policy templates_all_own on workout_templates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reached through the parent template, so ownership is checked there.
create policy template_exercises_all_own on template_exercises
  for all using (
    exists (select 1 from workout_templates t
            where t.id = template_exercises.template_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from workout_templates t
            where t.id = template_exercises.template_id and t.user_id = auth.uid())
  );

create policy workout_exercises_all_own on workout_exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Save a finished (or in-progress) workout as a preset, in one call.
-- Takes the distinct exercises in the order they were first performed, and
-- records how many working sets each actually got.
-- ---------------------------------------------------------------------------
create or replace function rpc_save_workout_as_template(
  p_workout_id uuid,
  p_name text
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_template_id uuid;
  v_user_id uuid;
begin
  select user_id into v_user_id from workouts where id = p_workout_id;
  if v_user_id is null or v_user_id <> auth.uid() then
    raise exception 'workout not found';
  end if;

  insert into workout_templates (user_id, name)
  values (auth.uid(), p_name)
  on conflict (user_id, lower(name)) do update set updated_at = now()
  returning id into v_template_id;

  -- Replace contents so re-saving over a name refreshes it.
  delete from template_exercises where template_id = v_template_id;

  insert into template_exercises
    (template_id, exercise_id, order_index, target_sets, target_rep_low, target_rep_high)
  select
    v_template_id,
    x.exercise_id,
    row_number() over (order by x.first_order) - 1,
    greatest(x.working_sets, 1),
    x.rep_low,
    x.rep_high
  from (
    select
      s.exercise_id,
      min(s.order_index)                                as first_order,
      count(*) filter (where not s.is_warmup)::int      as working_sets,
      min(s.target_rep_low)                             as rep_low,
      max(s.target_rep_high)                            as rep_high
    from sets s
    where s.workout_id = p_workout_id
    group by s.exercise_id
  ) x;

  return v_template_id;
end $$;

-- ---------------------------------------------------------------------------
-- Start a workout from a preset: creates the session and its exercise slots.
-- Reuses an already-open workout rather than creating a second one.
-- ---------------------------------------------------------------------------
create or replace function rpc_start_workout_from_template(p_template_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_workout_id uuid;
begin
  if not exists (select 1 from workout_templates
                 where id = p_template_id and user_id = auth.uid()) then
    raise exception 'template not found';
  end if;

  select id into v_workout_id
  from workouts
  where user_id = auth.uid() and ended_at is null
  limit 1;

  if v_workout_id is null then
    insert into workouts (user_id) values (auth.uid()) returning id into v_workout_id;
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
