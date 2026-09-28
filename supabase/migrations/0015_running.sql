-- Rust Strength — running, part 1: the data model.
--
--   * A run is an activity (kind 'run') plus one row in `runs` with the detail:
--     moving and elapsed time, splits, climb, effort, and the route. So the
--     calendar, activity totals and the leaderboard's activity time pick runs
--     up with no changes.
--   * The route is ONE geometry per run (PostGIS LineStringZM: Z is altitude,
--     M is seconds from the start), never one row per GPS point. It arrives
--     as an encoded polyline plus two small arrays.
--   * run_best_efforts: fastest mile / 5K / 10K / half / marathon inside each
--     run, so personal records are a MIN() away.
--   * run_privacy_zones, saved_routes, run_preferences: used by later parts of
--     the feature, created now so runs can reference them.
--
-- Everything is private to its owner. Nothing here is visible to friends; the
-- feed changes that share a run (with privacy trimming) come in a later
-- migration.
--
-- Needs PostGIS, which Supabase includes: this enables it in the `extensions`
-- schema, where Supabase keeps extensions.
--
-- Safe to re-run.

create extension if not exists postgis with schema extensions;
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- saved_routes: a run saved to be run again. Attempts point at it.
-- ---------------------------------------------------------------------------
create table if not exists saved_routes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  route            geometry(LineString, 4326) not null,
  distance_m       double precision not null check (distance_m > 0 and distance_m <= 400000),
  from_activity_id uuid references activities (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists saved_routes_user_idx on saved_routes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- runs: the detail behind a run activity
-- ---------------------------------------------------------------------------
create table if not exists runs (
  activity_id      uuid primary key references activities (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  /** gps: recorded; manual: typed in; treadmill: typed in, indoors. */
  source           text not null default 'gps' check (source in ('gps', 'manual', 'treadmill')),
  distance_m       double precision not null check (distance_m > 0 and distance_m <= 400000),
  moving_seconds   int not null check (moving_seconds > 0 and moving_seconds < 172800),
  elapsed_seconds  int not null check (elapsed_seconds >= moving_seconds and elapsed_seconds < 172800),
  elevation_gain_m real check (elevation_gain_m is null or elevation_gain_m between 0 and 10000),
  elevation_loss_m real check (elevation_loss_m is null or elevation_loss_m between 0 and 10000),
  /** Perceived effort, 1 (easy) to 10 (all out). */
  effort           smallint check (effort is null or effort between 1 and 10),
  /** [[seconds, elevation change or null, distance_m], ...] per mile or km. */
  splits           jsonb not null default '[]'::jsonb
                   check (jsonb_typeof(splits) = 'array' and jsonb_array_length(splits) <= 500),
  route            geometry(LineStringZM, 4326),
  has_elevation    boolean not null default false,
  route_id         uuid references saved_routes (id) on delete set null,
  /** Who may see the map if the run is shared. Friends see stats only unless 'friends'. */
  map_visibility   text not null default 'private' check (map_visibility in ('private', 'friends')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- An average faster than 7 m/s (a 3:50 mile) over a whole run is a typo.
  check (distance_m / moving_seconds <= 7),
  -- Recorded runs have a route; typed-in ones never do.
  check ((source = 'gps') = (route is not null))
);
create index if not exists runs_user_idx on runs (user_id);
create index if not exists runs_route_idx on runs (route_id) where route_id is not null;

-- ---------------------------------------------------------------------------
-- run_best_efforts: fastest times for standard distances inside each run
-- ---------------------------------------------------------------------------
create table if not exists run_best_efforts (
  activity_id uuid not null references runs (activity_id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  effort_key  text not null check (effort_key in ('mile', '5k', '10k', 'half', 'marathon')),
  seconds     int not null check (seconds > 0 and seconds < 172800),
  primary key (activity_id, effort_key)
);
create index if not exists run_best_efforts_pr_idx on run_best_efforts (user_id, effort_key, seconds);

-- ---------------------------------------------------------------------------
-- run_privacy_zones: places whose start and end get hidden when sharing
-- ---------------------------------------------------------------------------
create table if not exists run_privacy_zones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text check (label is null or char_length(label) <= 40),
  center     geography(Point, 4326) not null,
  radius_m   int not null check (radius_m between 200 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists run_privacy_zones_user_idx on run_privacy_zones (user_id);

-- Ten is plenty (home, work, a parent's house...) and keeps trimming cheap.
create or replace function enforce_privacy_zone_limit()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if (select count(*) from run_privacy_zones z where z.user_id = new.user_id) >= 10 then
    raise exception 'You can have up to 10 privacy zones.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists run_privacy_zones_limit on run_privacy_zones;
create trigger run_privacy_zones_limit
  before insert on run_privacy_zones
  for each row execute function enforce_privacy_zone_limit();

-- ---------------------------------------------------------------------------
-- run_preferences: per-person running settings
-- ---------------------------------------------------------------------------
create table if not exists run_preferences (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  auto_pause    boolean not null default true,
  audio_cues    boolean not null default true,
  /** Post finished runs to the friends feed by default. */
  share_default boolean not null default true,
  /** Default map visibility for a shared run. Stats only unless changed. */
  map_default   text not null default 'private' check (map_default in ('private', 'friends')),
  weekly_goal_m double precision check (weekly_goal_m is null or (weekly_goal_m > 0 and weekly_goal_m <= 1000000)),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: every row belongs to one person, and only they can touch it.
-- ---------------------------------------------------------------------------
alter table saved_routes      enable row level security;
alter table runs              enable row level security;
alter table run_best_efforts  enable row level security;
alter table run_privacy_zones enable row level security;
alter table run_preferences   enable row level security;

drop policy if exists saved_routes_all_own      on saved_routes;
drop policy if exists runs_all_own              on runs;
drop policy if exists run_best_efforts_all_own  on run_best_efforts;
drop policy if exists run_privacy_zones_all_own on run_privacy_zones;
drop policy if exists run_preferences_all_own   on run_preferences;

create policy saved_routes_all_own on saved_routes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The detail row must hang off one of your own run activities.
create policy runs_all_own on runs
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from activities a
      where a.id = runs.activity_id and a.user_id = auth.uid() and a.kind = 'run'
    )
    and (
      route_id is null
      or exists (select 1 from saved_routes s where s.id = runs.route_id and s.user_id = auth.uid())
    )
  );

create policy run_best_efforts_all_own on run_best_efforts
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from runs r where r.activity_id = run_best_efforts.activity_id and r.user_id = auth.uid())
  );

create policy run_privacy_zones_all_own on run_privacy_zones
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy run_preferences_all_own on run_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Effort distances, in one place for the SQL below.
-- ---------------------------------------------------------------------------
create or replace function run_effort_metres(p_key text)
returns double precision
language sql
immutable
as $$
  select case p_key
    when 'mile' then 1609.344
    when '5k' then 5000
    when '10k' then 10000
    when 'half' then 21097.5
    when 'marathon' then 42195
  end::double precision;
$$;

-- ---------------------------------------------------------------------------
-- rpc_save_run: the activity, the run and its best efforts in one go.
--
-- SECURITY INVOKER, so RLS applies to every insert; the checks here exist to
-- give a clear error and to validate what RLS cannot (the route itself).
-- p_id is generated by the app, so an offline save that gets replayed after
-- it already went through returns the same run instead of a duplicate.
-- ---------------------------------------------------------------------------
create or replace function rpc_save_run(
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
  p_map_visibility   text default 'private'
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
  elsif p_polyline is not null or p_alts is not null or p_times is not null then
    raise exception 'Only a recorded run has a route.';
  end if;

  begin
    insert into activities (id, user_id, kind, name, performed_at, duration_seconds,
                            distance, distance_unit, calories, note)
    values (
      p_id, uid, 'run', nullif(btrim(p_name), ''), p_performed_at, p_moving_seconds,
      round((p_distance_m / case p_distance_unit when 'mi' then 1609.344 else 1000 end)::numeric, 2),
      p_distance_unit, p_calories, nullif(btrim(p_note), '')
    );
  exception when unique_violation then
    -- Someone else's id: RLS hid it from the check above.
    raise exception 'That run id is already in use.';
  end;

  insert into runs (activity_id, user_id, source, distance_m, moving_seconds, elapsed_seconds,
                    elevation_gain_m, elevation_loss_m, effort, splits, route, has_elevation,
                    map_visibility)
  values (
    p_id, uid, p_source, p_distance_m, p_moving_seconds, p_elapsed_seconds,
    p_elevation_gain_m, p_elevation_loss_m, p_effort, coalesce(p_splits, '[]'::jsonb), v_route,
    v_route is not null and p_alts is not null, p_map_visibility
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
  text, real, real, int, int, jsonb, text, real[], int[], jsonb, text) from public, anon;
grant execute on function rpc_save_run(uuid, timestamptz, text, double precision, int, int, text, text,
  text, real, real, int, int, jsonb, text, real[], int[], jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_get_run: one of your own runs, with its route unpacked for the app.
-- SECURITY INVOKER: RLS means another person's id simply returns nothing.
-- ---------------------------------------------------------------------------
create or replace function rpc_get_run(p_activity_id uuid)
returns table (
  id               uuid,
  name             text,
  note             text,
  performed_at     timestamptz,
  calories         int,
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
  best_efforts     jsonb
)
language sql
security invoker
stable
set search_path = public, extensions
as $$
  select
    a.id, a.name, a.note, a.performed_at, a.calories, a.distance_unit,
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
    )
  from activities a
  join runs r on r.activity_id = a.id
  where a.id = p_activity_id;
$$;

revoke all on function rpc_get_run(uuid) from public, anon;
grant execute on function rpc_get_run(uuid) to authenticated;
