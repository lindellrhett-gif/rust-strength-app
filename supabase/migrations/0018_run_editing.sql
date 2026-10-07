-- 0018_run_editing.sql
--
-- Editing a saved run: its title, notes and effort, and trimming its start or
-- end (a run left recording on the drive home, or started a block early).
--
-- 1. runs.distances and runs.moving_times: the distance and moving time so
--    far at every point of the route. Distance can't be worked out again from
--    the line alone, because a manual pause leaves a jump in it that was
--    never run; with these, a trimmed run's distance, moving time, splits and
--    best efforts come out exactly as they would have on the day, and the
--    pace chart has something true to draw. Runs saved before this have
--    neither and simply can't be trimmed.
-- 2. rpc_save_run takes them (p_distances, p_moving_times, both optional) and
--    rpc_get_run returns them. Changing a function's arguments or result
--    means dropping and recreating it.
-- 3. rpc_update_run_details: title, notes, effort and map visibility.
-- 4. rpc_crop_run: keeps points p_from..p_to of the route. The server cuts
--    the line and re-bases its times itself; the app sends the totals it
--    worked out for the shorter run, and they have to agree with the line.
--
-- Everything is SECURITY INVOKER: RLS limits each person to their own runs,
-- and another person's id simply finds nothing. Signed-in users only, as in
-- 0016. Additive: the released app calls none of these functions.

alter table runs add column if not exists distances real[];
alter table runs add column if not exists moving_times int[];

drop function if exists rpc_save_run(uuid, timestamptz, text, double precision, int, int, text, text,
  text, real, real, int, int, jsonb, text, real[], int[], jsonb, text, int);

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
  p_moving_times     int[] default null
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
                    map_visibility, distances, moving_times)
  values (
    p_id, uid, p_source, p_distance_m, p_moving_seconds, p_elapsed_seconds,
    p_elevation_gain_m, p_elevation_loss_m, p_effort, coalesce(p_splits, '[]'::jsonb), v_route,
    v_route is not null and p_alts is not null, p_map_visibility, p_distances, p_moving_times
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
  text, real, real, int, int, jsonb, text, real[], int[], jsonb, text, int, real[], int[]) from public, anon;
grant execute on function rpc_save_run(uuid, timestamptz, text, double precision, int, int, text, text,
  text, real, real, int, int, jsonb, text, real[], int[], jsonb, text, int, real[], int[]) to authenticated;

drop function if exists rpc_get_run(uuid);

create function rpc_get_run(p_activity_id uuid)
returns table (
  id               uuid,
  name             text,
  note             text,
  performed_at     timestamptz,
  calories         int,
  steps            int,
  distance_unit    text,
  source           text,
  distance_m       double precision,
  moving_seconds   int,
  elapsed_seconds  int,
  elevation_gain_m real,
  elevation_loss_m real,
  effort           smallint,
  splits           jsonb,
  has_elevation    boolean,
  map_visibility   text,
  route_id         uuid,
  polyline         text,
  alts             real[],
  times            int[],
  best_efforts     jsonb,
  distances        real[],
  moving_times     int[]
)
language sql
security invoker
stable
set search_path = public, extensions
as $$
  select
    a.id, a.name, a.note, a.performed_at, a.calories, a.steps, a.distance_unit,
    r.source, r.distance_m, r.moving_seconds, r.elapsed_seconds,
    r.elevation_gain_m, r.elevation_loss_m, r.effort, r.splits, r.has_elevation,
    r.map_visibility, r.route_id,
    case when r.route is null then null else ST_AsEncodedPolyline(ST_Force2D(r.route), 5) end,
    case when r.route is null or not r.has_elevation then null else (
      select array_agg(ST_Z(dp.geom)::real order by dp.path[1]) from ST_DumpPoints(r.route) dp
    ) end,
    case when r.route is null then null else (
      select array_agg(ST_M(dp.geom)::int order by dp.path[1]) from ST_DumpPoints(r.route) dp
    ) end,
    coalesce(
      (select jsonb_object_agg(e.effort_key, e.seconds) from run_best_efforts e where e.activity_id = a.id),
      '{}'::jsonb
    ),
    r.distances,
    r.moving_times
  from activities a
  join runs r on r.activity_id = a.id
  where a.id = p_activity_id;
$$;

revoke all on function rpc_get_run(uuid) from public, anon;
grant execute on function rpc_get_run(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_update_run_details: the parts of a run you type in afterwards.
-- A null map visibility leaves it as it is.
-- ---------------------------------------------------------------------------
create function rpc_update_run_details(
  p_activity_id    uuid,
  p_name           text,
  p_note           text,
  p_effort         int,
  p_map_visibility text default null
)
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
  if p_name is not null and char_length(btrim(p_name)) > 80 then
    raise exception 'Keep the title under 80 characters.';
  end if;
  if p_note is not null and char_length(p_note) > 2000 then
    raise exception 'Keep notes under 2000 characters.';
  end if;
  if p_effort is not null and (p_effort < 1 or p_effort > 10) then
    raise exception 'Effort is 1 to 10.';
  end if;
  if p_map_visibility is not null and p_map_visibility not in ('private', 'friends') then
    raise exception 'Map visibility must be private or friends.';
  end if;

  update runs
     set effort = p_effort,
         map_visibility = coalesce(p_map_visibility, map_visibility),
         updated_at = now()
   where activity_id = p_activity_id and user_id = uid;
  if not found then
    raise exception 'Run not found.';
  end if;

  update activities
     set name = nullif(btrim(p_name), ''),
         note = nullif(btrim(p_note), '')
   where id = p_activity_id and user_id = uid;
end $$;

revoke all on function rpc_update_run_details(uuid, text, text, int, text) from public, anon;
grant execute on function rpc_update_run_details(uuid, text, text, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_crop_run: keep points p_from..p_to (1-based, inclusive) of the route.
-- ---------------------------------------------------------------------------
create function rpc_crop_run(
  p_activity_id      uuid,
  p_from             int,
  p_to               int,
  p_distance_m       double precision,
  p_moving_seconds   int,
  p_elapsed_seconds  int,
  p_elevation_gain_m real,
  p_elevation_loss_m real,
  p_calories         int,
  p_splits           jsonb,
  p_best_efforts     jsonb,
  p_steps            int
)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  uid       uuid := auth.uid();
  r         runs%rowtype;
  v_unit    text;
  v_n       int;
  v_d0      real;
  v_mt0     int;
  v_m0      double precision;
  v_route   geometry;
  v_dist    real[];
  v_moving  int[];
  v_key     text;
  v_secs    int;
begin
  if uid is null then
    raise exception 'Sign in to edit a run.' using errcode = '42501';
  end if;

  select * into r from runs where activity_id = p_activity_id and user_id = uid for update;
  if not found then
    raise exception 'Run not found.';
  end if;
  if r.route is null or r.distances is null or r.moving_times is null then
    raise exception 'This run can''t be trimmed.';
  end if;

  v_n := ST_NPoints(r.route);
  if p_from is null or p_to is null or p_from < 1 or p_to > v_n or p_to - p_from < 1 then
    raise exception 'Keep at least two points of the route.';
  end if;

  v_d0  := r.distances[p_from];
  v_mt0 := r.moving_times[p_from];
  select ST_M(dp.geom) into v_m0 from ST_DumpPoints(r.route) dp where dp.path[1] = p_from;

  v_dist   := array(select r.distances[i] - v_d0 from generate_series(p_from, p_to) i);
  v_moving := array(select r.moving_times[i] - v_mt0 from generate_series(p_from, p_to) i);

  select ST_SetSRID(
           ST_MakeLine(
             array_agg(
               ST_MakePoint(ST_X(dp.geom), ST_Y(dp.geom), ST_Z(dp.geom), ST_M(dp.geom) - v_m0)
               order by dp.path[1]
             )
           ),
           4326)
    into v_route
    from ST_DumpPoints(r.route) dp
   where dp.path[1] between p_from and p_to;

  -- The app's totals for the shorter run have to match the line it keeps.
  if p_distance_m is null or abs(v_dist[array_length(v_dist, 1)] - p_distance_m) > 1 then
    raise exception 'The trimmed distance does not match the route.';
  end if;
  if p_moving_seconds is null or abs(v_moving[array_length(v_moving, 1)] - p_moving_seconds) > 2 then
    raise exception 'The trimmed moving time does not match the route.';
  end if;
  if p_elapsed_seconds is null
     or abs(ST_M(ST_EndPoint(v_route)) - p_elapsed_seconds) > 2
     or p_elapsed_seconds < p_moving_seconds then
    raise exception 'The trimmed time does not match the route.';
  end if;
  if p_distance_m <= 0 or p_moving_seconds <= 0 then
    raise exception 'Keep some of the run.';
  end if;
  if p_calories is not null and (p_calories < 0 or p_calories > 20000) then
    raise exception 'Calories out of range.';
  end if;
  if p_steps is not null and (p_steps < 0 or p_steps > greatest(p_elapsed_seconds, 60) * 5) then
    raise exception 'That step count is not believable.';
  end if;
  if jsonb_typeof(coalesce(p_splits, '[]'::jsonb)) <> 'array' then
    raise exception 'Splits must be a list.';
  end if;
  if jsonb_typeof(coalesce(p_best_efforts, '{}'::jsonb)) <> 'object' then
    raise exception 'Best efforts must be an object.';
  end if;

  update runs
     set route = v_route,
         distances = v_dist,
         moving_times = v_moving,
         distance_m = p_distance_m,
         moving_seconds = p_moving_seconds,
         elapsed_seconds = p_elapsed_seconds,
         elevation_gain_m = case when r.has_elevation then p_elevation_gain_m else null end,
         elevation_loss_m = case when r.has_elevation then p_elevation_loss_m else null end,
         splits = coalesce(p_splits, '[]'::jsonb),
         updated_at = now()
   where activity_id = p_activity_id;

  select distance_unit into v_unit from activities where id = p_activity_id;
  update activities
     set performed_at = performed_at + make_interval(secs => v_m0),
         duration_seconds = p_moving_seconds,
         distance = round((p_distance_m / case v_unit when 'km' then 1000 else 1609.344 end)::numeric, 2),
         calories = p_calories,
         steps = p_steps
   where id = p_activity_id and user_id = uid;

  delete from run_best_efforts where activity_id = p_activity_id;
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
    values (p_activity_id, uid, v_key, v_secs);
  end loop;
end $$;

revoke all on function rpc_crop_run(uuid, int, int, double precision, int, int, real, real, int, jsonb, jsonb, int)
  from public, anon;
grant execute on function rpc_crop_run(uuid, int, int, double precision, int, int, real, real, int, jsonb, jsonb, int)
  to authenticated;
