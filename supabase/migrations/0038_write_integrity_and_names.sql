-- 0038_write_integrity_and_names.sql
--
-- SECURITY FIXES from the November 23, 2026 audit.
--
-- 1. Sets only on your own workouts. The sets policy checked that a set was
--    yours, not that its workout was, and foreign keys don't check row-level
--    security. A friend, who sees your workout ids in the feed, could add sets
--    to your workout, and the feed counted every set on a workout whoever
--    saved it: fake volume and records, and their own custom exercise's name,
--    any text, on your post. Nobody had (checked on the live data: no set or
--    workout exercise belongs to someone other than its workout's owner).
--    Now a set, or a workout exercise, must be on your own workout, with an
--    exercise you can see (the shared library or your own) and, for a set,
--    your own machine. Presets get the same exercise check. The feed also
--    only counts the owner's own sets, in case such a row ever exists.
--
-- 2. Names friends can see are checked by the server, not only the app. The
--    app limits usernames to 3-20 lowercase letters, numbers and underscores,
--    but the table took anything: a name that looks official, abusive text or
--    one long enough to break a friend's screen. Now:
--      - a chosen username follows the app's rule and can't pose as the app
--        or its staff (rust strength, bluestem, admin, support and similar);
--        the random name every account starts with ("lifter_7f3a91") stays
--        allowed;
--      - a display name is at most 40 characters, with no control characters;
--      - exercise, workout and activity names, which friends see on posts,
--        are at most 80, 60 and 60 characters, the same limits as the app.
--    Every row on the live database already passes (checked before writing
--    this), so the checks are added and validated at once.
--
-- APPLY ANY TIME with the owner's OK: the app already keeps to all of this.

-- ---------------------------------------------------------------------------
-- 1. Sets and workout exercises only on your own workouts.
-- ---------------------------------------------------------------------------
drop policy if exists sets_all_own on sets;
create policy sets_all_own on sets
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from workouts w where w.id = sets.workout_id and w.user_id = auth.uid())
    and exists (
      select 1 from exercises e
      where e.id = sets.exercise_id and (e.user_id is null or e.user_id = auth.uid())
    )
    and (
      sets.machine_id is null
      or exists (select 1 from machines m where m.id = sets.machine_id and m.user_id = auth.uid())
    )
  );

drop policy if exists workout_exercises_all_own on workout_exercises;
create policy workout_exercises_all_own on workout_exercises
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from workouts w where w.id = workout_exercises.workout_id and w.user_id = auth.uid())
    and exists (
      select 1 from exercises e
      where e.id = workout_exercises.exercise_id and (e.user_id is null or e.user_id = auth.uid())
    )
  );

drop policy if exists template_exercises_all_own on template_exercises;
create policy template_exercises_all_own on template_exercises
  for all to authenticated
  using (
    exists (select 1 from workout_templates t where t.id = template_exercises.template_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from workout_templates t where t.id = template_exercises.template_id and t.user_id = auth.uid())
    and exists (
      select 1 from exercises e
      where e.id = template_exercises.exercise_id and (e.user_id is null or e.user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- The feed counts only the workout owner's own sets: private.feed_posts as in
-- 0037, with "s.user_id = w.user_id" added to its three reads of sets.
-- ---------------------------------------------------------------------------
create or replace function private.feed_posts(
  p_limit  int,
  p_before timestamptz,
  p_author uuid
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
  featured_trophies text[],
  unit             text
)
language sql
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
  where (p_author is null or a.uid = p_author)
    and (
      a.uid = m.uid
      or (
        coalesce((select p.share_workouts from profiles p where p.user_id = a.uid), true)
        and not exists (
          select 1 from user_blocks b
          where (b.blocker_id = m.uid and b.blocked_id = a.uid)
             or (b.blocker_id = a.uid and b.blocked_id = m.uid)
        )
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
      sum(s.weight * s.reps)
        filter (where w.user_id = auth.uid() or not private.reveals_bodyweight(s)) as volume,
      count(*)               as total_sets,
      sum(s.reps)            as total_reps
    from sets s
    where s.workout_id = w.id and s.user_id = w.user_id and s.is_warmup = false
  ) agg on true
  left join lateral (
    -- Exercises in the order they were first worked, so the chips read like
    -- the session did.
    select array_agg(x.ex_name order by x.first_order) as names
    from (
      select e.name as ex_name, min(s.order_index) as first_order
      from sets s
      join exercises e on e.id = s.exercise_id
      where s.workout_id = w.id and s.user_id = w.user_id and s.is_warmup = false
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
      where s.workout_id = w.id and s.user_id = w.user_id and s.is_warmup = false
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
  coalesce(pr.featured_trophies, '{}'::text[]) as featured_trophies,
  pr.unit::text as unit
from posts p
join profiles pr on pr.user_id = p.user_id
order by p.occurred_at desc;
$$;

-- Reached only through the two functions below, which run as its owner.
revoke all on function private.feed_posts(int, timestamptz, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Names friends can see.
-- ---------------------------------------------------------------------------
-- Dropped first so the migration can be run again.
alter table profiles drop constraint if exists profiles_username_shape;
alter table profiles drop constraint if exists profiles_username_not_official;
alter table profiles drop constraint if exists profiles_display_name_shape;
alter table exercises drop constraint if exists exercises_name_length;
alter table workouts drop constraint if exists workouts_name_length;
alter table activities drop constraint if exists activities_name_length;

alter table profiles
  add constraint profiles_username_shape check (
    username ~ '^[a-z0-9_]{3,20}$'
    or (not username_chosen and username ~ '^lifter_[0-9a-f]{6,32}$')
  ),
  add constraint profiles_username_not_official check (
    not username_chosen
    or (
      username !~ '(rust_?strength|bluestem)'
      and username !~ '(^|_)(admin|administrator|support|official|moderator|mod|staff|team|help)(_|$)'
    )
  ),
  add constraint profiles_display_name_shape check (
    display_name is null or (char_length(display_name) <= 40 and display_name !~ '[[:cntrl:]]')
  );

alter table exercises add constraint exercises_name_length check (char_length(name) <= 80);
alter table workouts add constraint workouts_name_length check (name is null or char_length(name) <= 60);
alter table activities add constraint activities_name_length check (name is null or char_length(name) <= 60);
