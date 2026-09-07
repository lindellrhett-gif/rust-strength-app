-- Gym App — Milestone 7: privacy, safety and account controls
--
-- Addresses concrete findings from the pre-launch legal audit:
--
--   1. Usernames were derived from the email local-part and are searchable by
--      any signed-in user, which published part of people's email addresses to
--      strangers. New accounts now get a neutral random handle.
--   2. No way to delete an account (App Store Guideline 5.1.1(v) requires one).
--   3. No way to export your own data (CCPA/CPRA right to access).
--   4. No way to report or block another user (App Review Guideline 1.2
--      requires both for apps with user-generated content).
--   5. No record that the user accepted the Terms or confirmed their age.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Consent + age record on the profile.
-- We deliberately store only "they confirmed they meet the minimum age", not a
-- date of birth — the DOB is not needed for anything and would be extra
-- sensitive data to hold.
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists terms_accepted_at timestamptz;
alter table profiles add column if not exists terms_version text;
alter table profiles add column if not exists age_confirmed_at timestamptz;
-- False while the handle is still the auto-generated one, so the app can
-- prompt the user to choose their own before they become discoverable.
alter table profiles add column if not exists username_chosen boolean not null default false;

-- ---------------------------------------------------------------------------
-- Neutral auto-generated usernames.
--
-- The previous version used split_part(new.email, '@', 1), which meant
-- "john.smith@example.com" became the publicly searchable handle "johnsmith".
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  tries int := 0;
begin
  loop
    -- e.g. "lifter_7f3a91" — carries no information about the person.
    candidate := 'lifter_' || substr(md5(random()::text || new.id::text), 1, 6);
    exit when not exists (select 1 from profiles where lower(username) = candidate);
    tries := tries + 1;
    if tries > 20 then
      candidate := 'lifter_' || replace(gen_random_uuid()::text, '-', '');
      exit;
    end if;
  end loop;

  insert into profiles (user_id, username, display_name, username_chosen)
  values (new.id, candidate, null, false);
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Blocking. Blocked users disappear from search and cannot send requests.
-- ---------------------------------------------------------------------------
create table if not exists user_blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (blocker_id <> blocked_id)
);
create unique index if not exists user_blocks_unique on user_blocks (blocker_id, blocked_id);
create index if not exists user_blocks_blocked_idx on user_blocks (blocked_id);

alter table user_blocks enable row level security;
drop policy if exists user_blocks_all_own on user_blocks;
create policy user_blocks_all_own on user_blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reports. Write-only from the user's side: a reporter can file one and see
-- their own, but nobody can read anyone else's.
-- ---------------------------------------------------------------------------
do $$ begin
  create type report_reason as enum (
    'harassment', 'impersonation', 'inappropriate_name', 'spam', 'other'
  );
exception when duplicate_object then null;
end $$;

create table if not exists user_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references auth.users (id) on delete cascade,
  reported_id  uuid not null references auth.users (id) on delete cascade,
  reason       report_reason not null default 'other',
  details      text check (details is null or length(details) <= 1000),
  status       text not null default 'open',
  created_at   timestamptz not null default now(),
  check (reporter_id <> reported_id)
);
create index if not exists user_reports_reported_idx on user_reports (reported_id, created_at desc);

alter table user_reports enable row level security;
drop policy if exists user_reports_insert_own on user_reports;
drop policy if exists user_reports_select_own on user_reports;
create policy user_reports_insert_own on user_reports
  for insert with check (reporter_id = auth.uid());
create policy user_reports_select_own on user_reports
  for select using (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Search excludes blocks in both directions, and anyone who has not yet chosen
-- a handle (so an auto-generated account is never surfaced to strangers).
-- ---------------------------------------------------------------------------
create or replace function rpc_search_users(q text)
returns table (user_id uuid, username text, display_name text)
language sql
security definer
set search_path = public
stable
as $$
  select p.user_id, p.username, p.display_name
  from profiles p
  where p.user_id <> auth.uid()
    and p.username_chosen = true
    and length(coalesce(q, '')) >= 3
    and p.username ilike (q || '%')
    and not exists (
      select 1 from user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
         or (b.blocker_id = p.user_id and b.blocked_id = auth.uid())
    )
  order by p.username
  limit 20;
$$;

-- ---------------------------------------------------------------------------
-- Blocking someone also tears down any friendship or pending request.
-- ---------------------------------------------------------------------------
create or replace function rpc_block_user(target uuid)
returns void
language plpgsql
security invoker
as $$
begin
  if target = auth.uid() then
    raise exception 'cannot block yourself';
  end if;

  insert into user_blocks (blocker_id, blocked_id)
  values (auth.uid(), target)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from friendships
  where (requester_id = auth.uid() and addressee_id = target)
     or (requester_id = target and addressee_id = auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Right to access: everything we hold about the caller, as one JSON document.
-- ---------------------------------------------------------------------------
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
    'blocks',      (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from user_blocks b where b.blocker_id = uid)
  ) into result;

  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Right to erasure. Deleting the auth user cascades to every table in this
-- schema, because every one of them references auth.users(id) on delete
-- cascade — including reports the user filed and reports filed against them.
--
-- That is a deliberate choice: full erasure is the simplest position to
-- defend and the one the Privacy Policy states. It does mean a user can shed
-- an abuse history by deleting and re-registering. Retaining reports past
-- deletion would need the FKs changed to `on delete set null`, a stated legal
-- basis, and disclosure in the policy — flagged in the audit rather than done
-- silently here.
-- ---------------------------------------------------------------------------
create or replace function rpc_delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  delete from auth.users where id = uid;
end $$;

revoke all on function rpc_delete_my_account() from public;
grant execute on function rpc_delete_my_account() to authenticated;
revoke all on function rpc_export_my_data() from public;
grant execute on function rpc_export_my_data() to authenticated;
