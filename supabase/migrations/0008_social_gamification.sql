-- Rust Strength — Milestone 8: friend feed, reactions, rest timer, XP badges
--
--   * A feed of friends' recent sessions, with one reaction per person per post.
--   * Rest-timer preferences on the profile.
--   * profile_badges: the handful of badges awarded by hand (Influencer,
--     Beta Tester). Everything else — XP, levels, level badges — stays derived
--     on the client from totals the user already has, so there is nothing to
--     forge and nothing to go stale.
--
-- Privacy note. This migration is the first time one user's *sessions* become
-- visible to another; until now a friend could only see aggregate totals.
-- Three things hold that line:
--   1. Only accepted friends are ever authors (`rpc_friend_feed`).
--   2. Every user can switch sharing off (`profiles.share_workouts`), and the
--      feed honours it.
--   3. A post is a summary. Set-by-set detail is never returned.
-- The privacy policy was updated in the same change.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Profile: sharing preference, rest-timer settings, last celebrated level
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists share_workouts boolean not null default true;

alter table profiles add column if not exists rest_seconds int not null default 120;
alter table profiles add column if not exists rest_auto boolean not null default true;

-- Which level the user has already been congratulated on, so the level-up
-- screen fires once rather than on every render after the threshold is crossed.
alter table profiles add column if not exists level_seen int not null default 1;

do $$ begin
  alter table profiles add constraint profiles_rest_seconds_range
    check (rest_seconds between 5 and 3600);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table profiles add constraint profiles_level_seen_range
    check (level_seen between 1 and 100);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- profile_badges — awarded, never earned in the app
--
-- SECURITY: this table deliberately has a SELECT policy and nothing else. With
-- RLS enabled and no INSERT/UPDATE/DELETE policy, a signed-in user cannot write
-- to it at all; only the service role can. A badge a user can grant themselves
-- is not a badge, and "Influencer" is exactly the kind of thing someone would
-- try to hand themselves through the public API.
--
-- To award one, from the Supabase SQL editor (which runs as the service role):
--   insert into profile_badges (user_id, badge_id)
--   select user_id, 'beta-tester' from profiles where username = 'someone';
-- ---------------------------------------------------------------------------
create table if not exists profile_badges (
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Slug only, matching the ids in src/domain/badges.ts. An id the app does not
  -- know about is ignored client-side rather than rendered as a blank medal.
  badge_id   text not null check (badge_id ~ '^[a-z0-9-]{1,40}$'),
  granted_at timestamptz not null default now(),
  note       text,
  primary key (user_id, badge_id)
);

alter table profile_badges enable row level security;
drop policy if exists profile_badges_select on profile_badges;

-- Your own badges, and your accepted friends' — nothing else.
create policy profile_badges_select on profile_badges
  for select using (user_id = auth.uid() or are_friends(auth.uid(), user_id));

-- ---------------------------------------------------------------------------
-- feed_reactions
--
-- Polymorphic over workouts and activities, so there is no foreign key to lean
-- on. `feed_subject_owner` resolves the owner instead, and delete triggers at
-- the bottom of this file clear reactions when their subject goes away.
-- ---------------------------------------------------------------------------
create table if not exists feed_reactions (
  id           uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('workout', 'activity')),
  subject_id   uuid not null,
  user_id      uuid not null references auth.users (id) on delete cascade,
  reaction     text not null check (reaction in ('fire', 'strong', 'heavy', 'respect')),
  created_at   timestamptz not null default now()
);

-- One reaction per person per post: changing your mind replaces it rather than
-- stacking, so a single friend cannot run the count up.
create unique index if not exists feed_reactions_one_per_user
  on feed_reactions (subject_type, subject_id, user_id);
create index if not exists feed_reactions_subject_idx
  on feed_reactions (subject_type, subject_id);

-- ---------------------------------------------------------------------------
-- Who owns a post, and may the caller react to it?
-- ---------------------------------------------------------------------------
create or replace function feed_subject_owner(p_type text, p_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select case p_type
    when 'workout' then
      (select w.user_id from workouts w where w.id = p_id and w.ended_at is not null)
    when 'activity' then
      (select a.user_id from activities a where a.id = p_id)
  end;
$$;

create or replace function can_react_to(p_type text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  owner  uuid;
  shares boolean;
begin
  owner := feed_subject_owner(p_type, p_id);
  -- No such post, or a workout that was never finished.
  if owner is null then return false; end if;
  -- Your own post.
  if owner = auth.uid() then return true; end if;
  if not are_friends(auth.uid(), owner) then return false; end if;

  select p.share_workouts into shares from profiles p where p.user_id = owner;
  if not coalesce(shares, true) then return false; end if;

  -- Blocking already tears down the friendship in 0007; this is belt and braces.
  if exists (
    select 1 from user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = owner)
       or (b.blocker_id = owner and b.blocked_id = auth.uid())
  ) then
    return false;
  end if;

  return true;
end $$;

alter table feed_reactions enable row level security;
drop policy if exists feed_reactions_select on feed_reactions;
drop policy if exists feed_reactions_insert on feed_reactions;
drop policy if exists feed_reactions_update on feed_reactions;
drop policy if exists feed_reactions_delete on feed_reactions;

-- Read your own reactions, and any reaction on a post you are allowed to see.
create policy feed_reactions_select on feed_reactions
  for select using (
    user_id = auth.uid()
    or feed_subject_owner(subject_type, subject_id) = auth.uid()
    or are_friends(auth.uid(), feed_subject_owner(subject_type, subject_id))
  );

-- You may only react as yourself, and only to a post you can reach.
create policy feed_reactions_insert on feed_reactions
  for insert with check (user_id = auth.uid() and can_react_to(subject_type, subject_id));
create policy feed_reactions_update on feed_reactions
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and can_react_to(subject_type, subject_id));
create policy feed_reactions_delete on feed_reactions
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- rpc_friend_feed
--
-- SECURITY DEFINER, because it reads other people's workouts. Authorship is
-- gated three ways before a single row is considered: accepted friendship,
-- sharing switched on, and no block in either direction. Your own posts are
-- included so the feed is not empty on day one.
--
-- What comes back is a summary — totals, exercise names, whether a lift was a
-- record. Individual sets never leave the server.
-- ---------------------------------------------------------------------------
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
  my_reaction      text
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
  -- Accepted friends who share, minus anyone blocked either way.
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
workout_posts as (
  select
    'workout'::text                                                        as subject_type,
    w.id                                                                   as subject_id,
    w.user_id                                                              as user_id,
    w.started_at                                                           as occurred_at,
    w.name                                                                 as name,
    greatest(0, extract(epoch from (w.ended_at - w.started_at)))::int       as duration_seconds,
    coalesce(agg.volume, 0)::float8                                        as volume,
    coalesce(agg.total_sets, 0)::int                                       as total_sets,
    coalesce(agg.total_reps, 0)::int                                       as total_reps,
    coalesce(names.names, '{}'::text[])                                    as exercise_names,
    coalesce(recs.n, 0)::int                                               as record_count,
    null::text                                                             as activity_kind,
    null::float8                                                           as distance,
    null::text                                                             as distance_unit
  from workouts w
  join allowed al on al.uid = w.user_id
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
  where w.ended_at is not null
    and (p_before is null or w.started_at < p_before)
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
    a.distance_unit::text   as distance_unit
  from activities a
  join allowed al on al.uid = a.user_id
  where p_before is null or a.performed_at < p_before
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
  ) as my_reaction
from posts p
join profiles pr on pr.user_id = p.user_id
order by p.occurred_at desc;
$$;

-- ---------------------------------------------------------------------------
-- rpc_friend_prs gains best_e1rm, which is what the XP "personal records"
-- source is summed from. A friend's level has to be computed from the same
-- inputs as their own or the two screens would disagree.
--
-- Postgres will not let `create or replace` change a function's OUT columns,
-- not even to append one, so the old definition is dropped first.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_prs(uuid);

create function rpc_friend_prs(target uuid)
returns table (
  exercise_name text,
  best_weight   double precision,
  best_reps     int,
  best_e1rm     double precision
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
    max(s.reps)::int,
    max(s.e1rm)::float8
  from sets s
  join exercises e on e.id = s.exercise_id
  where s.user_id = target and s.is_warmup = false
  group by e.name;
end $$;

-- ---------------------------------------------------------------------------
-- rpc_friend_stats gains friend_count.
--
-- Friendships are worth XP, so without this a friend's level would read up to
-- 500 points low on their profile compared with what they see themselves — a
-- whole level early on. It is a bare count; no names, no ids.
--
-- One gap remains and is deliberate: a friend's *rest days* stay private, so
-- their best streak is computed here from training days alone. Where someone
-- has bridged a streak with rest days, their level can read slightly low to a
-- friend. Publishing the days somebody chose not to train, to close a cosmetic
-- gap, is not a trade worth making.
--
-- OUT columns change, so the old definition has to go first.
-- ---------------------------------------------------------------------------
drop function if exists rpc_friend_stats(uuid);

create function rpc_friend_stats(target uuid)
returns table (
  user_id           uuid,
  username          text,
  display_name      text,
  total_workouts    bigint,
  total_volume      double precision,
  total_reps        bigint,
  total_sets        bigint,
  total_seconds     bigint,
  workout_dates     text[],
  activity_seconds  bigint,
  activity_count    bigint,
  activity_kinds    bigint,
  friend_count      bigint
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
    coalesce(w.volume, 0)::float8,
    coalesce(w.total_reps, 0),
    coalesce(w.total_sets, 0),
    coalesce(w.total_seconds, 0),
    coalesce(w.dates, array[]::text[]),
    coalesce(a.total_seconds, 0),
    coalesce(a.total_activities, 0),
    coalesce(a.distinct_kinds, 0),
    coalesce(f.friend_count, 0)
  from profiles p
  left join lateral (
    select
      count(distinct wo.id) filter (where wo.ended_at is not null) as total_workouts,
      sum(s.weight * s.reps)                                      as volume,
      sum(s.reps)::bigint                                         as total_reps,
      count(s.id)::bigint                                         as total_sets,
      sum(
        extract(epoch from (wo.ended_at - wo.started_at))
      ) filter (where wo.ended_at is not null)::bigint            as total_seconds,
      array_agg(distinct to_char(wo.started_at, 'YYYY-MM-DD'))
        filter (where wo.ended_at is not null)                    as dates
    from workouts wo
    left join sets s on s.workout_id = wo.id
    where wo.user_id = p.user_id
  ) w on true
  left join lateral (
    select
      sum(ac.duration_seconds)::bigint as total_seconds,
      count(*)::bigint                 as total_activities,
      count(distinct ac.kind)::bigint  as distinct_kinds
    from activities ac
    where ac.user_id = p.user_id
  ) a on true
  left join lateral (
    select count(*)::bigint as friend_count
    from friendships fr
    where fr.status = 'accepted'
      and (fr.requester_id = p.user_id or fr.addressee_id = p.user_id)
  ) f on true
  where p.user_id = target;
end $$;

revoke all on function rpc_friend_stats(uuid) from public;
grant execute on function rpc_friend_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Orphan cleanup. feed_reactions cannot carry a foreign key to two different
-- tables, so deleting a workout or an activity clears its reactions by hand.
-- Without this, cancelling a workout would leave reaction rows pointing at
-- nothing.
-- ---------------------------------------------------------------------------
create or replace function cleanup_feed_reactions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from feed_reactions
  where subject_type = tg_argv[0]
    and subject_id = old.id;
  return old;
end $$;

drop trigger if exists workouts_cleanup_reactions on workouts;
create trigger workouts_cleanup_reactions
  after delete on workouts
  for each row execute function cleanup_feed_reactions('workout');

drop trigger if exists activities_cleanup_reactions on activities;
create trigger activities_cleanup_reactions
  after delete on activities
  for each row execute function cleanup_feed_reactions('activity');

-- ---------------------------------------------------------------------------
-- Account deletion and data export must cover the new tables too, or "delete
-- my account" would leave reactions behind and the export would be incomplete.
-- Both are re-declared here rather than patched, so this file is the current
-- definition.
-- ---------------------------------------------------------------------------
create or replace function rpc_delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  -- Reactions this user left on other people's posts have no cascade path.
  delete from feed_reactions where user_id = me;
  -- Reactions other people left on this user's posts go with the posts, via
  -- the delete triggers above.
  delete from auth.users where id = me;
end $$;

-- The export is the user's right-of-access response, so it has to cover the
-- new tables as well. Re-declared in full rather than patched.
create or replace function rpc_export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public
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
    'reactions',   (select coalesce(jsonb_agg(to_jsonb(fr)), '[]'::jsonb) from feed_reactions fr where fr.user_id = uid)
  ) into result;

  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Grants. A dropped function loses its privileges, and new functions are
-- executable by PUBLIC unless told otherwise, so every one of them is set
-- explicitly here rather than left to the default.
-- ---------------------------------------------------------------------------
revoke all on function rpc_friend_feed(int, timestamptz) from public;
grant execute on function rpc_friend_feed(int, timestamptz) to authenticated;

revoke all on function rpc_friend_prs(uuid) from public;
grant execute on function rpc_friend_prs(uuid) to authenticated;

revoke all on function rpc_delete_my_account() from public;
grant execute on function rpc_delete_my_account() to authenticated;

revoke all on function rpc_export_my_data() from public;
grant execute on function rpc_export_my_data() to authenticated;

-- These two are called from inside RLS policies, so `authenticated` must be
-- able to execute them; anonymous callers have no business with either.
revoke all on function feed_subject_owner(text, uuid) from public;
grant execute on function feed_subject_owner(text, uuid) to authenticated;

revoke all on function can_react_to(text, uuid) from public;
grant execute on function can_react_to(text, uuid) to authenticated;
