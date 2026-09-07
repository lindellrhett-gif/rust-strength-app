-- Gym App — Milestone 4: tiered trophies
--
-- Trophies now ladder from Wood to Legend, which needs two things the schema
-- did not expose yet:
--   * best REPS in a single set per exercise (drives the calisthenics ladders),
--   * a friend's per-exercise bests, so their trophies render on their profile.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- v_exercise_prs gains best_reps
-- ---------------------------------------------------------------------------
create or replace view v_exercise_prs
with (security_invoker = true) as
select
  s.user_id,
  s.exercise_id,
  e.name                         as exercise_name,
  e.muscle_group,
  max(s.e1rm)::float8            as best_e1rm,
  max(s.weight)::float8          as best_weight,
  max(s.weight * s.reps)::float8 as best_set_volume,
  -- Appended last on purpose: `create or replace view` can only add columns at
  -- the end, never reorder or rename the existing ones.
  max(s.reps)::int               as best_reps
from sets s
join exercises e on e.id = s.exercise_id
where s.is_warmup = false
group by s.user_id, s.exercise_id, e.name, e.muscle_group;

-- ---------------------------------------------------------------------------
-- A friend's per-exercise bests, for rendering their trophy shelf.
-- Same friendship gate as rpc_friend_stats.
-- ---------------------------------------------------------------------------
create or replace function rpc_friend_prs(target uuid)
returns table (
  exercise_name text,
  best_weight   double precision,
  best_reps     int
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
    e.name,
    max(s.weight)::float8,
    max(s.reps)::int
  from sets s
  join exercises e on e.id = s.exercise_id
  where s.user_id = target and s.is_warmup = false
  group by e.name;
end $$;
