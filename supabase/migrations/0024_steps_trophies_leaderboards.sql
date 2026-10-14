-- 0024_steps_trophies_leaderboards.sql
--
-- Daily steps for friends, running and steps leaderboards, trophies for
-- running, steps, friends and reactions, and a trophy or two by your name.
--
-- 1. Daily steps, shared only by people who turn it on. profiles.share_steps
--    is off by default. While it's on, the app uploads one total per day for
--    the last week (rpc_sync_daily_steps); turning it off deletes every total
--    already shared (rpc_set_share_steps). daily_steps is owner-only under
--    RLS; friends only ever see totals through the leaderboard and friend
--    stats below, and only for people who share.
-- 2. profiles.featured_trophies: up to two "trophy:tier" ids to show by your
--    name. Trophies are worked out on the phone from your stats, so the
--    server checks only the shape of what's saved.
-- 3. rpc_my_trophy_totals: lifetime run distance, shared steps, and how many
--    reactions friends left on your posts. That last one needs SECURITY
--    DEFINER: each reaction row is visible only to the person who left it,
--    so you can't count the ones on your own posts yourself. It returns a
--    count, never who reacted.
-- 4. rpc_friend_stats and rpc_friend_leaderboard gain run distance, steps
--    (null for anyone not sharing), reactions received and featured
--    trophies. Columns are only added at the end, and the released app reads
--    them by name, so it carries on as before.
-- 5. rpc_friend_feed shows the outline of your own runs in your feed, and
--    each post carries its author's featured trophies.
-- 6. "Download my data" includes the shared daily steps.
--
-- Additive: safe to apply before 1.1 ships. Signed-in users only, as in 0016.

alter table profiles add column if not exists share_steps boolean not null default false;
alter table profiles add column if not exists featured_trophies text[] not null default '{}';

alter table profiles drop constraint if exists profiles_featured_trophies_shape;
alter table profiles add constraint profiles_featured_trophies_shape check (
  cardinality(featured_trophies) <= 2
  and array_to_string(featured_trophies, ',') ~
      '^([a-z0-9-]{1,40}:(wood|stone|silver|gold|platinum|diamond|emerald|ruby|legend)(,|$))*$'
);

-- ---------------------------------------------------------------------------
-- Daily steps
-- ---------------------------------------------------------------------------
create table if not exists daily_steps (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  steps      int not null check (steps between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table daily_steps enable row level security;
drop policy if exists daily_steps_all_own on daily_steps;
create policy daily_steps_all_own on daily_steps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- One total per day, for days in the last week (the phone keeps seven).
-- A day's total only ever goes up: steps can't be untaken.
create or replace function rpc_sync_daily_steps(p_days jsonb)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  v_day date;
  v_n   int;
  saved int := 0;
  e     jsonb;
begin
  if uid is null then
    raise exception 'Sign in to share steps.' using errcode = '42501';
  end if;
  if not coalesce((select p.share_steps from profiles p where p.user_id = uid), false) then
    raise exception 'Daily steps are not being shared.';
  end if;
  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) > 8 then
    raise exception 'Send up to 8 days of steps.';
  end if;
  for e in select * from jsonb_array_elements(p_days) loop
    begin
      v_day := (e->>'day')::date;
      v_n := (e->>'steps')::int;
    exception when others then
      raise exception 'Each day needs a date and a number of steps.';
    end;
    -- Generous at both ends, since "today" depends on the time zone.
    if v_day is null or v_n is null
       or v_day < (now() at time zone 'utc')::date - 8
       or v_day > (now() at time zone 'utc')::date + 1 then
      raise exception 'Steps can only be shared for the last week.';
    end if;
    if v_n < 0 or v_n > 100000 then
      raise exception 'That step count is not believable.';
    end if;
    insert into daily_steps (user_id, day, steps)
    values (uid, v_day, v_n)
    on conflict (user_id, day) do update
      set steps = greatest(daily_steps.steps, excluded.steps), updated_at = now();
    saved := saved + 1;
  end loop;
  return saved;
end $$;

-- Turning sharing off deletes what was shared.
create or replace function rpc_set_share_steps(p_on boolean)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  update profiles set share_steps = coalesce(p_on, false) where user_id = auth.uid();
  if not coalesce(p_on, false) then
    delete from daily_steps where user_id = auth.uid();
  end if;
end $$;

revoke all on function rpc_sync_daily_steps(jsonb) from public, anon;
grant execute on function rpc_sync_daily_steps(jsonb) to authenticated;
revoke all on function rpc_set_share_steps(boolean) from public, anon;
grant execute on function rpc_set_share_steps(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- A run's distance in metres, from its detail row or, for one logged by hand
-- before running existed, from the activity's own distance and unit.
-- ---------------------------------------------------------------------------
create or replace function run_metres(a activities)
returns double precision
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select rn.distance_m from runs rn where rn.activity_id = a.id),
    a.distance * case a.distance_unit when 'mi' then 1609.344 when 'km' then 1000 when 'm' then 1 end,
    0
  );
$$;

revoke all on function run_metres(activities) from public, anon, authenticated;

-- How many reactions friends left on someone's posts. Not callable directly.
create or replace function reactions_received(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from feed_reactions fr
  where fr.user_id <> p_user
    and (
      (fr.subject_type = 'workout'
        and exists (select 1 from workouts w where w.id = fr.subject_id and w.user_id = p_user))
      or (fr.subject_type = 'activity'
        and exists (select 1 from activities a where a.id = fr.subject_id and a.user_id = p_user))
    );
$$;

revoke all on function reactions_received(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- rpc_my_trophy_totals: what the new trophies are worked out from.
-- ---------------------------------------------------------------------------
create or replace function rpc_my_trophy_totals()
returns table (run_distance_m double precision, steps_total bigint, reactions_received bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(run_metres(a)) from activities a where a.user_id = auth.uid() and a.kind = 'run'), 0)::float8,
    coalesce((
      select sum(d.steps) from daily_steps d
      join profiles p on p.user_id = d.user_id and p.share_steps
      where d.user_id = auth.uid()
    ), 0)::bigint,
    reactions_received(auth.uid())
  where auth.uid() is not null;
$$;

revoke all on function rpc_my_trophy_totals() from public, anon;
grant execute on function rpc_my_trophy_totals() to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_friend_stats: as in 0014, plus run distance, shared steps, reactions
-- received and featured trophies, all at the end.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_stats(uuid, date);

create or replace function rpc_friend_stats(target uuid, p_today date default current_date)
returns table (
  user_id            uuid,
  username           text,
  display_name       text,
  total_workouts     bigint,
  total_volume       double precision,
  total_reps         bigint,
  total_sets         bigint,
  total_seconds      bigint,
  workout_dates      text[],
  activity_seconds   bigint,
  activity_count     bigint,
  activity_kinds     bigint,
  friend_count       bigint,
  current_streak     int,
  best_streak        int,
  consistency_30     int,
  run_distance_m     double precision,
  steps_total        bigint,
  reactions_received bigint,
  featured_trophies  text[]
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
    coalesce(w.total_workouts, 0),
    coalesce(st.volume, 0)::float8,
    coalesce(st.total_reps, 0),
    coalesce(st.total_sets, 0),
    coalesce(w.total_seconds, 0),
    coalesce(w.dates, array[]::text[]),
    coalesce(a.total_seconds, 0),
    coalesce(a.total_activities, 0),
    coalesce(a.distinct_kinds, 0),
    coalesce(f.friend_count, 0),
    ss.current_streak,
    ss.best_streak,
    ss.consistency_30,
    coalesce(a.run_metres, 0)::float8,
    case when p.share_steps
      then coalesce((select sum(d.steps) from daily_steps d where d.user_id = p.user_id), 0)::bigint
    end,
    reactions_received(p.user_id),
    p.featured_trophies
  from profiles p
  -- Workouts on their own: joining sets here is what multiplied the time.
  left join lateral (
    select
      count(*) filter (where wo.ended_at is not null)::bigint as total_workouts,
      sum(extract(epoch from (wo.ended_at - wo.started_at)))
        filter (where wo.ended_at is not null)::bigint        as total_seconds,
      array_agg(distinct to_char(wo.started_at, 'YYYY-MM-DD'))
        filter (where wo.ended_at is not null)                as dates
    from workouts wo
    where wo.user_id = p.user_id
  ) w on true
  left join lateral (
    select
      sum(s.weight * s.reps)  as volume,
      sum(s.reps)::bigint     as total_reps,
      count(*)::bigint        as total_sets
    from sets s
    where s.user_id = p.user_id
  ) st on true
  left join lateral (
    select
      sum(ac.duration_seconds)::bigint as total_seconds,
      count(*)::bigint                 as total_activities,
      count(distinct ac.kind)::bigint  as distinct_kinds,
      sum(run_metres(ac)) filter (where ac.kind = 'run') as run_metres
    from activities ac
    where ac.user_id = p.user_id
  ) a on true
  left join lateral (
    select count(*)::bigint as friend_count
    from friendships fr
    where fr.status = 'accepted'
      and (fr.requester_id = p.user_id or fr.addressee_id = p.user_id)
  ) f on true
  cross join lateral streak_stats(p.user_id, p_today) ss
  where p.user_id = target;
end $$;

revoke all on function rpc_friend_stats(uuid, date) from public, anon;
grant execute on function rpc_friend_stats(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_friend_leaderboard: as in 0014, plus run distance and shared steps in
-- the period. Steps are null for anyone not sharing, who is then left off
-- that board.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_leaderboard(timestamptz, date);

create or replace function rpc_friend_leaderboard(
  p_since timestamptz default null,
  p_today date default current_date
)
returns table (
  user_id          uuid,
  username         text,
  display_name     text,
  unit             weight_unit,
  is_me            boolean,
  total_volume     double precision,
  workout_seconds  bigint,
  activity_seconds bigint,
  current_streak   int,
  consistency_30   int,
  run_distance_m   double precision,
  steps            bigint
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
    ss.current_streak,
    ss.consistency_30,
    coalesce(a.run_metres, 0)::float8,
    case when p.share_steps then coalesce(ds.steps, 0)::bigint end
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
    select
      sum(ac.duration_seconds) as seconds,
      sum(run_metres(ac)) filter (where ac.kind = 'run') as run_metres
    from activities ac
    where ac.user_id = p.user_id
      and (p_since is null or ac.performed_at >= p_since)
  ) a on true
  left join lateral (
    select sum(d.steps) as steps
    from daily_steps d
    where d.user_id = p.user_id
      and (p_since is null or d.day >= (p_since at time zone 'utc')::date)
  ) ds on true
  cross join lateral streak_stats(p.user_id, p_today) ss
  where auth.uid() is not null;
$$;

revoke all on function rpc_friend_leaderboard(timestamptz, date) from public, anon;
grant execute on function rpc_friend_leaderboard(timestamptz, date) to authenticated;

-- ---------------------------------------------------------------------------
-- rpc_friend_feed: your own runs show their outline; posts carry their
-- author's featured trophies. Otherwise as in 0021.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_feed(int, timestamptz);

create or replace function rpc_friend_feed(
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
  route_preview    text,
  featured_trophies text[]
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
    -- The map only when its owner chose to share it (or it's your own run),
    -- and only the trimmed, simplified line: never the raw route, never the
    -- zones themselves.
    case
      when a.kind = 'run'
       and (a.user_id = auth.uid()
            or exists (select 1 from runs rn where rn.activity_id = a.id and rn.map_visibility = 'friends'))
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
  p.route_preview,
  coalesce(pr.featured_trophies, '{}'::text[]) as featured_trophies
from posts p
join profiles pr on pr.user_id = p.user_id
order by p.occurred_at desc;
$$;

revoke all on function rpc_friend_feed(int, timestamptz) from public, anon;
grant execute on function rpc_friend_feed(int, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- "Download my data": as in 0023, plus the shared daily steps.
-- ---------------------------------------------------------------------------
create or replace function rpc_export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'account', (
      select jsonb_build_object('email', u.email, 'created_at', u.created_at)
      from auth.users u where u.id = uid
    ),
    'profile',     (select to_jsonb(p) from profiles p where p.user_id = uid),
    'workouts',    (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from workouts w where w.user_id = uid),
    'sets',        (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from sets s where s.user_id = uid),
    'activities',  (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from activities a where a.user_id = uid),
    'rest_days',   (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from rest_days r where r.user_id = uid),
    'templates',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from workout_templates t where t.user_id = uid),
    'planned',     (select coalesce(jsonb_agg(to_jsonb(pl)), '[]'::jsonb) from planned_sessions pl where pl.user_id = uid),
    'machines',    (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from machines m where m.user_id = uid),
    'gyms',        (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from gyms g where g.user_id = uid),
    'custom_exercises', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from exercises e where e.user_id = uid),
    'friendships', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from friendships f
                    where f.requester_id = uid or f.addressee_id = uid),
    'blocks',      (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from user_blocks b where b.blocker_id = uid),
    'badges',      (select coalesce(jsonb_agg(to_jsonb(pb)), '[]'::jsonb) from profile_badges pb where pb.user_id = uid),
    'reactions',   (select coalesce(jsonb_agg(to_jsonb(fr)), '[]'::jsonb) from feed_reactions fr where fr.user_id = uid),
    -- Running (0015 onwards). Routes come out as GeoJSON, which any mapping
    -- tool can open (longitude, latitude, altitude in metres), with the
    -- seconds from the start at each point alongside as route_times.
    'runs',        (select coalesce(jsonb_agg(
                      (to_jsonb(rn) - 'route')
                      || jsonb_build_object('route', case when rn.route is null then null
                                                          else ST_AsGeoJSON(rn.route)::jsonb end)
                      || jsonb_build_object('route_times', (
                           select array_agg(ST_M(dp.geom)::int order by dp.path[1])
                           from ST_DumpPoints(rn.route) dp))
                    ), '[]'::jsonb) from runs rn where rn.user_id = uid),
    'run_best_efforts', (select coalesce(jsonb_agg(to_jsonb(be)), '[]'::jsonb) from run_best_efforts be where be.user_id = uid),
    'run_privacy_zones', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', z.id, 'label', z.label, 'radius_m', z.radius_m, 'created_at', z.created_at,
                      'lat', ST_Y(z.center::geometry), 'lon', ST_X(z.center::geometry)
                    )), '[]'::jsonb) from run_privacy_zones z where z.user_id = uid),
    'saved_routes', (select coalesce(jsonb_agg(
                      (to_jsonb(sr) - 'route') || jsonb_build_object('route', ST_AsGeoJSON(sr.route)::jsonb)
                    ), '[]'::jsonb) from saved_routes sr where sr.user_id = uid),
    'run_preferences', (select to_jsonb(rp) from run_preferences rp where rp.user_id = uid),
    -- Daily step totals, only ever uploaded while sharing them is on (0024).
    'daily_steps', (select coalesce(jsonb_agg(to_jsonb(ds) order by ds.day), '[]'::jsonb)
                    from daily_steps ds where ds.user_id = uid)
  ) into result;

  return result;
end $$;

revoke all on function rpc_export_my_data() from public, anon;
grant execute on function rpc_export_my_data() to authenticated;
