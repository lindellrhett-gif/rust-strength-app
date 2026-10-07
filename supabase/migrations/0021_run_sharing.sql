-- 0021_run_sharing.sql
--
-- Sharing runs with friends, privately.
--
-- 1. activities.share_to_feed (default true, so every existing post stays
--    as it is). A run takes its default from the runner's "share new runs"
--    setting when it is saved; either can be changed per run afterwards.
-- 2. run_shared_route(): the only version of a route anyone else ever sees.
--    It drops the first and last 200 m of every run, and keeps dropping from
--    each end while the route is inside one of the owner's privacy zones,
--    so a run that starts at home never shows where home is. What is left
--    is simplified to a light outline. A route that passes through a zone
--    in the middle stays visible there: zones hide where a run starts and
--    ends, not where it goes.
-- 3. rpc_friend_feed leaves out runs kept off the feed (except in your own),
--    and adds route_preview, only for runs whose owner shared the map
--    (runs.map_visibility = 'friends'; stats only is the default).
-- 4. Privacy zones are added, listed and removed through three RPCs, so the
--    app never handles PostGIS types and a zone's position can't be read by
--    anyone but its owner (the table's RLS is owner-only, as before).
-- 5. rpc_update_run_details takes the feed choice; rpc_get_run returns it.
--
-- run_shared_route is SECURITY DEFINER because it has to read the owner's
-- zones for a friend's feed; nobody can call it directly, only the feed.
-- Everything else is SECURITY INVOKER and own-data-only through RLS.
-- Signed-in users only, as in 0016.

alter table activities add column if not exists share_to_feed boolean not null default true;

-- ---------------------------------------------------------------------------
-- New runs follow the runner's "share new runs to the feed" setting.
-- ---------------------------------------------------------------------------
create or replace function apply_run_share_default()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.kind = 'run' then
    new.share_to_feed := coalesce(
      (select rp.share_default from run_preferences rp where rp.user_id = new.user_id),
      new.share_to_feed
    );
  end if;
  return new;
end $$;

drop trigger if exists activities_run_share_default on activities;
create trigger activities_run_share_default
  before insert on activities
  for each row execute function apply_run_share_default();

revoke all on function apply_run_share_default() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- run_shared_route: the trimmed, simplified outline of a run, or null.
-- ---------------------------------------------------------------------------
create or replace function run_shared_route(p_activity_id uuid)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  with run as (
    select r.user_id, r.route from runs r where r.activity_id = p_activity_id and r.route is not null
  ),
  pts as (
    select dp.path[1] as i, dp.geom as g, run.user_id
    from run, ST_DumpPoints(run.route) dp
  ),
  stepped as (
    select i, g, user_id,
           coalesce(ST_Distance((lag(g) over (order by i))::geography, g::geography), 0) as step
    from pts
  ),
  measured as (
    select i, g, user_id,
           sum(step) over (order by i) as d,
           sum(step) over () as total
    from stepped
  ),
  flagged as (
    select i, g,
           d < 200
           or total - d < 200
           or exists (
             select 1 from run_privacy_zones z
             where z.user_id = measured.user_id
               and ST_DWithin(z.center, g::geography, z.radius_m)
           ) as hidden
    from measured
  ),
  bounds as (
    select min(i) filter (where not hidden) as lo, max(i) filter (where not hidden) as hi from flagged
  ),
  kept as (
    select ST_MakeLine(array_agg(ST_Force2D(f.g) order by f.i)) as line
    from flagged f, bounds b
    where b.lo is not null and b.hi - b.lo >= 1 and f.i between b.lo and b.hi
  )
  select case when line is null then null
              else ST_AsEncodedPolyline(ST_Simplify(line, 0.00005), 5) end
  from kept;
$$;

revoke all on function run_shared_route(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privacy zones
-- ---------------------------------------------------------------------------
create function rpc_my_privacy_zones()
returns table (id uuid, label text, lat double precision, lon double precision, radius_m int)
language sql
security invoker
stable
set search_path = public, extensions
as $$
  select z.id, z.label, ST_Y(z.center::geometry), ST_X(z.center::geometry), z.radius_m
  from run_privacy_zones z
  where z.user_id = auth.uid()
  order by z.created_at;
$$;

create function rpc_add_privacy_zone(p_lat double precision, p_lon double precision, p_radius_m int, p_label text)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  uid  uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then
    raise exception 'Sign in to add a privacy zone.' using errcode = '42501';
  end if;
  if p_lat is null or p_lon is null or p_lat < -90 or p_lat > 90 or p_lon < -180 or p_lon > 180 then
    raise exception 'That place is not on the map.';
  end if;
  if p_radius_m is null or p_radius_m < 200 or p_radius_m > 1000 then
    raise exception 'A privacy zone''s radius is 200 to 1000 metres.';
  end if;
  if p_label is not null and char_length(btrim(p_label)) > 40 then
    raise exception 'Keep the name under 40 characters.';
  end if;
  insert into run_privacy_zones (user_id, label, center, radius_m)
  values (uid, nullif(btrim(p_label), ''), ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_radius_m)
  returning id into v_id;
  return v_id;
end $$;

create function rpc_remove_privacy_zone(p_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from run_privacy_zones where id = p_id and user_id = auth.uid();
$$;

revoke all on function rpc_my_privacy_zones() from public, anon;
grant execute on function rpc_my_privacy_zones() to authenticated;
revoke all on function rpc_add_privacy_zone(double precision, double precision, int, text) from public, anon;
grant execute on function rpc_add_privacy_zone(double precision, double precision, int, text) to authenticated;
revoke all on function rpc_remove_privacy_zone(uuid) from public, anon;
grant execute on function rpc_remove_privacy_zone(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_update_run_details gains the feed choice (null leaves it as it is).
-- ---------------------------------------------------------------------------
drop function if exists rpc_update_run_details(uuid, text, text, int, text);

create function rpc_update_run_details(
  p_activity_id    uuid,
  p_name           text,
  p_note           text,
  p_effort         int,
  p_map_visibility text default null,
  p_share_to_feed  boolean default null
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
         note = nullif(btrim(p_note), ''),
         share_to_feed = coalesce(p_share_to_feed, share_to_feed)
   where id = p_activity_id and user_id = uid;
end $$;

revoke all on function rpc_update_run_details(uuid, text, text, int, text, boolean) from public, anon;
grant execute on function rpc_update_run_details(uuid, text, text, int, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_get_run returns the feed choice.
-- ---------------------------------------------------------------------------
drop function if exists rpc_get_run(uuid);

create function rpc_get_run(p_activity_id uuid)
returns table (
  id               uuid,
  name             text,
  note             text,
  performed_at     timestamptz,
  calories         int,
  steps            int,
  share_to_feed    boolean,
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
    a.id, a.name, a.note, a.performed_at, a.calories, a.steps, a.share_to_feed, a.distance_unit,
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
-- rpc_friend_feed: runs kept off the feed stay off; shared maps come trimmed.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_feed(int, timestamptz);

create function rpc_friend_feed(
  p_limit  int default 30,
  p_before timestamptz default null
)
returns table (
  subject_type     text,
  subject_id       uuid,
  user_id          uuid,
  username         text,
  display_name     text,
  occurred_at      timestamptz,
  name             text,
  duration_seconds int,
  volume           double precision,
  total_sets       int,
  total_reps       int,
  exercise_names   text[],
  record_count     int,
  activity_kind    text,
  distance         double precision,
  distance_unit    text,
  badge_ids        text[],
  reaction_counts  jsonb,
  my_reaction      text,
  route_preview    text
)
language sql
security definer
set search_path = public
stable
as $$
with me as (
  select auth.uid() as uid
),
authors as (
  select
    case when f.requester_id = m.uid then f.addressee_id else f.requester_id end as uid
  from friendships f
  cross join me m
  where f.status = 'accepted'
    and (f.requester_id = m.uid or f.addressee_id = m.uid)
  union
  select uid from me
),
allowed as (
  select a.uid
  from authors a
  cross join me m
  where a.uid = m.uid
     or (
       coalesce((select p.share_workouts from profiles p where p.user_id = a.uid), true)
       and not exists (
         select 1 from user_blocks b
         where (b.blocker_id = m.uid and b.blocked_id = a.uid)
            or (b.blocker_id = a.uid and b.blocked_id = m.uid)
       )
     )
),

-- Candidates first. These two reads are index-only work and cap how many rows
-- the aggregates below ever touch.
workout_candidates as (
  select w.id, w.user_id, w.started_at, w.ended_at, w.name
  from workouts w
  join allowed al on al.uid = w.user_id
  where w.ended_at is not null
    and (p_before is null or w.started_at < p_before)
  order by w.started_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
),
activity_candidates as (
  select a.id, a.user_id, a.performed_at, a.name, a.duration_seconds,
         a.kind, a.distance, a.distance_unit
  from activities a
  join allowed al on al.uid = a.user_id
  -- A run kept off the feed is still in your own.
  where (a.share_to_feed or a.user_id = auth.uid())
    and (p_before is null or a.performed_at < p_before)
  order by a.performed_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
),

workout_posts as (
  select
    'workout'::text                                                  as subject_type,
    w.id                                                             as subject_id,
    w.user_id                                                        as user_id,
    w.started_at                                                     as occurred_at,
    w.name                                                           as name,
    greatest(0, extract(epoch from (w.ended_at - w.started_at)))::int as duration_seconds,
    coalesce(agg.volume, 0)::float8                                  as volume,
    coalesce(agg.total_sets, 0)::int                                 as total_sets,
    coalesce(agg.total_reps, 0)::int                                 as total_reps,
    coalesce(names.names, '{}'::text[])                              as exercise_names,
    coalesce(recs.n, 0)::int                                         as record_count,
    null::text                                                       as activity_kind,
    null::float8                                                     as distance,
    null::text                                                       as distance_unit,
    null::text                                                       as route_preview
  from workout_candidates w
  left join lateral (
    select
      sum(s.weight * s.reps) as volume,
      count(*)               as total_sets,
      sum(s.reps)            as total_reps
    from sets s
    where s.workout_id = w.id and s.is_warmup = false
  ) agg on true
  left join lateral (
    -- Exercises in the order they were first worked, so the chips read like
    -- the session did.
    select array_agg(x.ex_name order by x.first_order) as names
    from (
      select e.name as ex_name, min(s.order_index) as first_order
      from sets s
      join exercises e on e.id = s.exercise_id
      where s.workout_id = w.id and s.is_warmup = false
      group by e.name
    ) x
  ) names on true
  left join lateral (
    -- A record is an exercise whose best e1RM in this session beat everything
    -- the user had done before it. Same test as rpc_workout_summary.
    select count(*)::int as n
    from (
      select s.exercise_id, max(s.e1rm) as best
      from sets s
      where s.workout_id = w.id and s.is_warmup = false
      group by s.exercise_id
    ) cur
    where cur.best > 0
      and cur.best > coalesce((
        select max(p.e1rm)
        from sets p
        where p.user_id = w.user_id
          and p.exercise_id = cur.exercise_id
          and p.is_warmup = false
          and p.workout_id <> w.id
          and p.performed_at < w.started_at
      ), 0)
  ) recs on true
),
activity_posts as (
  select
    'activity'::text        as subject_type,
    a.id                    as subject_id,
    a.user_id               as user_id,
    a.performed_at          as occurred_at,
    a.name                  as name,
    a.duration_seconds      as duration_seconds,
    0::float8               as volume,
    0                       as total_sets,
    0                       as total_reps,
    '{}'::text[]            as exercise_names,
    0                       as record_count,
    a.kind::text            as activity_kind,
    a.distance::float8      as distance,
    a.distance_unit::text   as distance_unit,
    -- The map only when its owner chose to share it, and only the trimmed,
    -- simplified line: never the raw route, never the zones themselves.
    case
      when a.kind = 'run'
       and exists (select 1 from runs rn where rn.activity_id = a.id and rn.map_visibility = 'friends')
      then run_shared_route(a.id)
    end                     as route_preview
  from activity_candidates a
),
posts as (
  select * from workout_posts
  union all
  select * from activity_posts
  order by occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
)
select
  p.subject_type,
  p.subject_id,
  p.user_id,
  pr.username,
  pr.display_name,
  p.occurred_at,
  p.name,
  p.duration_seconds,
  p.volume,
  p.total_sets,
  p.total_reps,
  p.exercise_names,
  p.record_count,
  p.activity_kind,
  p.distance,
  p.distance_unit,
  coalesce((
    select array_agg(pb.badge_id order by pb.granted_at)
    from profile_badges pb
    where pb.user_id = p.user_id
  ), '{}'::text[]) as badge_ids,
  coalesce((
    select jsonb_object_agg(r.reaction, r.n)
    from (
      select fr.reaction, count(*) as n
      from feed_reactions fr
      where fr.subject_type = p.subject_type and fr.subject_id = p.subject_id
      group by fr.reaction
    ) r
  ), '{}'::jsonb) as reaction_counts,
  (
    select fr.reaction
    from feed_reactions fr
    where fr.subject_type = p.subject_type
      and fr.subject_id = p.subject_id
      and fr.user_id = auth.uid()
  ) as my_reaction,
  p.route_preview
from posts p
join profiles pr on pr.user_id = p.user_id
order by p.occurred_at desc;
$$;

revoke all on function rpc_friend_feed(int, timestamptz) from public, anon;
grant execute on function rpc_friend_feed(int, timestamptz) to authenticated;
