-- 0022_saved_routes.sql
--
-- Saved routes: keep a run's route to run it again and compare attempts.
--
-- 1. rpc_save_route turns one of your runs into a saved route (its line,
--    without altitude or times) and counts that run as its first attempt.
-- 2. rpc_saved_routes lists your routes with how many times you've run each
--    and your best time, plus a light outline for the list.
-- 3. rpc_saved_route and rpc_route_attempts give one route's full line and
--    every attempt, fastest first.
-- 4. rpc_set_run_route links a run to one of your routes afterwards, or
--    unlinks it (null).
-- 5. rpc_save_run takes p_route_id, for a run recorded while following a
--    saved route.
--
-- Renaming and deleting a route go straight through the table, which RLS
-- already limits to its owner; deleting one leaves its runs as they were
-- (runs.route_id is set to null). The runs RLS policy (0015) already
-- refuses a route that belongs to someone else.
-- All SECURITY INVOKER, signed-in users only, as in 0016.

drop function if exists rpc_save_run(uuid, timestamptz, text, double precision, int, int, text, text,
  text, real, real, int, int, jsonb, text, real[], int[], jsonb, text, int, real[], int[]);

create function rpc_save_run(
  p_id               uuid,
  p_performed_at     timestamptz,
  p_source           text,
  p_distance_m       double precision,
  p_moving_seconds   int,
  p_elapsed_seconds  int,
  p_distance_unit    text,
  p_name             text default null,
  p_note             text default null,
  p_elevation_gain_m real default null,
  p_elevation_loss_m real default null,
  p_calories         int default null,
  p_effort           int default null,
  p_splits           jsonb default '[]'::jsonb,
  p_polyline         text default null,
  p_alts             real[] default null,
  p_times            int[] default null,
  p_best_efforts     jsonb default '{}'::jsonb,
  p_map_visibility   text default 'private',
  p_steps            int default null,
  p_distances        real[] default null,
  p_moving_times     int[] default null,
  p_route_id         uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  uid     uuid := auth.uid();
  v_line  geometry;
  v_route geometry;
  v_n     int;
  v_key   text;
  v_secs  int;
begin
  if uid is null then
    raise exception 'Sign in to save a run.' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'A run needs an id.';
  end if;

  -- A replay of a save that already happened.
  if exists (select 1 from activities a where a.id = p_id) then
    if exists (select 1 from runs r where r.activity_id = p_id and r.user_id = uid) then
      return p_id;
    end if;
    raise exception 'That run id is already in use.';
  end if;

  if p_source is null or p_source not in ('gps', 'manual', 'treadmill') then
    raise exception 'Unknown run source.';
  end if;
  if p_distance_unit is null or p_distance_unit not in ('mi', 'km') then
    raise exception 'Distance unit must be mi or km.';
  end if;
  if p_performed_at is null
     or p_performed_at > now() + interval '1 day'
     or p_performed_at < timestamptz '2000-01-01' then
    raise exception 'That date is not believable.';
  end if;
  if p_name is not null and char_length(p_name) > 80 then
    raise exception 'Keep the title under 80 characters.';
  end if;
  if p_note is not null and char_length(p_note) > 2000 then
    raise exception 'Keep notes under 2000 characters.';
  end if;
  if p_calories is not null and (p_calories < 0 or p_calories > 20000) then
    raise exception 'Calories out of range.';
  end if;
  if p_effort is not null and (p_effort < 1 or p_effort > 10) then
    raise exception 'Effort is 1 to 10.';
  end if;
  -- Five steps a second (300 a minute) is past an all-out sprint.
  if p_steps is not null and (p_steps < 0 or p_steps > greatest(coalesce(p_elapsed_seconds, 0), 60) * 5) then
    raise exception 'That step count is not believable.';
  end if;
  if coalesce(p_map_visibility, '') not in ('private', 'friends') then
    raise exception 'Map visibility must be private or friends.';
  end if;
  -- RLS would refuse someone else's route anyway; this says why.
  if p_route_id is not null and not exists (
    select 1 from saved_routes s where s.id = p_route_id and s.user_id = uid
  ) then
    raise exception 'Route not found.';
  end if;
  if jsonb_typeof(coalesce(p_splits, '[]'::jsonb)) <> 'array' then
    raise exception 'Splits must be a list.';
  end if;
  if jsonb_typeof(coalesce(p_best_efforts, '{}'::jsonb)) <> 'object' then
    raise exception 'Best efforts must be an object.';
  end if;

  if p_source = 'gps' then
    if p_polyline is null or char_length(p_polyline) = 0 or char_length(p_polyline) > 400000 then
      raise exception 'A recorded run needs its route.';
    end if;
    begin
      v_line := ST_SetSRID(ST_LineFromEncodedPolyline(p_polyline, 5), 4326);
    exception when others then
      raise exception 'The route could not be read.';
    end;
    v_n := ST_NPoints(v_line);
    if v_n is null or v_n < 2 or v_n > 20000 then
      raise exception 'A route has 2 to 20000 points.';
    end if;
    if ST_XMin(v_line) < -180 or ST_XMax(v_line) > 180 or ST_YMin(v_line) < -90 or ST_YMax(v_line) > 90 then
      raise exception 'The route has impossible coordinates.';
    end if;
    if p_times is null or coalesce(array_length(p_times, 1), 0) <> v_n then
      raise exception 'Every route point needs a time.';
    end if;
    if p_times[1] <> 0
       or p_times[v_n] > p_elapsed_seconds + 60
       or exists (
         select 1 from generate_subscripts(p_times, 1) i
         where p_times[i] is null or p_times[i] < 0 or (i > 1 and p_times[i] < p_times[i - 1])
       ) then
      raise exception 'Route times must start at 0 and never go backwards.';
    end if;
    if p_alts is not null and (
         coalesce(array_length(p_alts, 1), 0) <> v_n
         or exists (select 1 from unnest(p_alts) a where a is null or a < -500 or a > 9000)
       ) then
      raise exception 'Route altitudes do not match the route.';
    end if;
    -- Distance and moving time so far at every point: what charts and
    -- trimming work from. Both start at 0 and never go backwards, distance
    -- ends at the run's total, and moving time never runs ahead of the clock
    -- or past the total. (With auto-pause off the total is all the time spent
    -- recording, a few seconds more than the points cover.)
    if (p_distances is null) <> (p_moving_times is null) then
      raise exception 'Send distances and moving times together.';
    end if;
    if p_distances is not null and (
         coalesce(array_length(p_distances, 1), 0) <> v_n
         or coalesce(array_length(p_moving_times, 1), 0) <> v_n
         or p_distances[1] <> 0 or p_moving_times[1] <> 0
         or abs(p_distances[v_n] - p_distance_m) > 1
         or p_moving_times[v_n] > p_moving_seconds + 2
         or exists (
           select 1 from generate_subscripts(p_distances, 1) i
           where p_distances[i] is null or p_moving_times[i] is null
              or p_moving_times[i] > p_times[i] + 1
              or (i > 1 and (p_distances[i] < p_distances[i - 1] or p_moving_times[i] < p_moving_times[i - 1]))
         )
       ) then
      raise exception 'Route distances and moving times do not match the run.';
    end if;
    -- You can't claim more distance than the line you drew, give or take the
    -- smoothing (and the pause jumps, which only make the line longer).
    if p_distance_m > ST_Length(v_line::geography) * 1.1 + 100 then
      raise exception 'The distance is longer than the route.';
    end if;

    select ST_SetSRID(
             ST_MakeLine(
               array_agg(
                 ST_MakePoint(
                   ST_X(dp.geom), ST_Y(dp.geom),
                   coalesce(p_alts[dp.path[1]], 0), p_times[dp.path[1]]
                 ) order by dp.path[1]
               )
             ),
             4326)
      into v_route
      from ST_DumpPoints(v_line) dp;
  elsif p_polyline is not null or p_alts is not null or p_times is not null
        or p_distances is not null or p_moving_times is not null then
    raise exception 'Only a recorded run has a route.';
  end if;

  begin
    insert into activities (id, user_id, kind, name, performed_at, duration_seconds,
                            distance, distance_unit, steps, calories, note)
    values (
      p_id, uid, 'run', nullif(btrim(p_name), ''), p_performed_at, p_moving_seconds,
      round((p_distance_m / case p_distance_unit when 'mi' then 1609.344 else 1000 end)::numeric, 2),
      p_distance_unit, p_steps, p_calories, nullif(btrim(p_note), '')
    );
  exception when unique_violation then
    -- Someone else's id: RLS hid it from the check above.
    raise exception 'That run id is already in use.';
  end;

  insert into runs (activity_id, user_id, source, distance_m, moving_seconds, elapsed_seconds,
                    elevation_gain_m, elevation_loss_m, effort, splits, route, has_elevation,
                    map_visibility, distances, moving_times, route_id)
  values (
    p_id, uid, p_source, p_distance_m, p_moving_seconds, p_elapsed_seconds,
    p_elevation_gain_m, p_elevation_loss_m, p_effort, coalesce(p_splits, '[]'::jsonb), v_route,
    v_route is not null and p_alts is not null, p_map_visibility, p_distances, p_moving_times, p_route_id
  );

  for v_key, v_secs in
    select e.key, (e.value)::int from jsonb_each_text(coalesce(p_best_efforts, '{}'::jsonb)) e
  loop
    if run_effort_metres(v_key) is null then
      raise exception 'Unknown best effort %.', v_key;
    end if;
    if run_effort_metres(v_key) > p_distance_m + 1
       or v_secs <= 0
       or run_effort_metres(v_key) / v_secs > 7 then
      raise exception 'The % best effort does not fit this run.', v_key;
    end if;
    insert into run_best_efforts (activity_id, user_id, effort_key, seconds)
    values (p_id, uid, v_key, v_secs);
  end loop;

  return p_id;
end $$;

revoke all on function rpc_save_run(uuid, timestamptz, text, double precision, int, int, text, text,
  text, real, real, int, int, jsonb, text, real[], int[], jsonb, text, int, real[], int[], uuid) from public, anon;
grant execute on function rpc_save_run(uuid, timestamptz, text, double precision, int, int, text, text,
  text, real, real, int, int, jsonb, text, real[], int[], jsonb, text, int, real[], int[], uuid) to authenticated;

-- ---------------------------------------------------------------------------
create function rpc_save_route(p_activity_id uuid, p_name text)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  uid  uuid := auth.uid();
  r    runs%rowtype;
  v_id uuid;
begin
  if uid is null then
    raise exception 'Sign in to save a route.' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Give the route a name of up to 80 characters.';
  end if;
  select * into r from runs where activity_id = p_activity_id and user_id = uid;
  if not found then
    raise exception 'Run not found.';
  end if;
  if r.route is null then
    raise exception 'Only a recorded run has a route to save.';
  end if;

  insert into saved_routes (user_id, name, route, distance_m, from_activity_id)
  values (uid, btrim(p_name), ST_SetSRID(ST_Force2D(r.route), 4326), r.distance_m, p_activity_id)
  returning id into v_id;

  update runs set route_id = v_id, updated_at = now() where activity_id = p_activity_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
create function rpc_saved_routes()
returns table (
  id            uuid,
  name          text,
  distance_m    double precision,
  created_at    timestamptz,
  attempts      int,
  best_seconds  int,
  last_run_at   timestamptz,
  outline       text
)
language sql
security invoker
stable
set search_path = public, extensions
as $$
  select
    s.id, s.name, s.distance_m, s.created_at,
    (select count(*)::int from runs r where r.route_id = s.id),
    (select min(r.moving_seconds) from runs r where r.route_id = s.id),
    (select max(a.performed_at) from runs r join activities a on a.id = r.activity_id where r.route_id = s.id),
    ST_AsEncodedPolyline(ST_Simplify(s.route, 0.0001), 5)
  from saved_routes s
  where s.user_id = auth.uid()
  order by s.created_at desc;
$$;

-- ---------------------------------------------------------------------------
create function rpc_saved_route(p_id uuid)
returns table (id uuid, name text, distance_m double precision, polyline text)
language sql
security invoker
stable
set search_path = public, extensions
as $$
  select s.id, s.name, s.distance_m, ST_AsEncodedPolyline(s.route, 5)
  from saved_routes s
  where s.id = p_id and s.user_id = auth.uid();
$$;

create function rpc_route_attempts(p_id uuid)
returns table (activity_id uuid, performed_at timestamptz, name text, moving_seconds int, distance_m double precision)
language sql
security invoker
stable
set search_path = public
as $$
  select r.activity_id, a.performed_at, a.name, r.moving_seconds, r.distance_m
  from runs r
  join activities a on a.id = r.activity_id
  where r.route_id = p_id and r.user_id = auth.uid()
  order by r.moving_seconds asc, a.performed_at asc;
$$;

-- ---------------------------------------------------------------------------
create function rpc_set_run_route(p_activity_id uuid, p_route_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to edit a run.' using errcode = '42501';
  end if;
  if p_route_id is not null and not exists (
    select 1 from saved_routes s where s.id = p_route_id and s.user_id = uid
  ) then
    raise exception 'Route not found.';
  end if;
  update runs set route_id = p_route_id, updated_at = now()
   where activity_id = p_activity_id and user_id = uid;
  if not found then
    raise exception 'Run not found.';
  end if;
end $$;

revoke all on function rpc_save_route(uuid, text) from public, anon;
grant execute on function rpc_save_route(uuid, text) to authenticated;
revoke all on function rpc_saved_routes() from public, anon;
grant execute on function rpc_saved_routes() to authenticated;
revoke all on function rpc_saved_route(uuid) from public, anon;
grant execute on function rpc_saved_route(uuid) to authenticated;
revoke all on function rpc_route_attempts(uuid) from public, anon;
grant execute on function rpc_route_attempts(uuid) to authenticated;
revoke all on function rpc_set_run_route(uuid, uuid) from public, anon;
grant execute on function rpc_set_run_route(uuid, uuid) to authenticated;
