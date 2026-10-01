-- Rust Strength — security hardening, from the Supabase security advisor.
--
--   1. Signed-out callers lose EXECUTE on every function they have no use
--      for. Earlier migrations ran `revoke all ... from public` meaning to do
--      exactly this, but Supabase grants EXECUTE to the `anon` role directly
--      as well as through PUBLIC, so those revokes never took it away, and a few
--      functions were never revoked at all. Nothing
--      leaked: each of these functions checks auth.uid() and returns nothing,
--      or raises, for a signed-out caller. This makes the lock real.
--   2. Trigger functions can't be called by anyone. They only ever run as
--      triggers, and Postgres checks EXECUTE on a trigger function when the
--      trigger is created, not when it fires, so this changes nothing about
--      sign-up or reaction cleanup.
--   3. are_friends() only answers about the caller's own friendships. It is a
--      helper for RLS policies and the friend RPCs, every one of which passes
--      auth.uid() as one of the two people, but called directly it would say
--      whether ANY two users are friends, and friend search hands out user
--      ids. That let a signed-in user map other people's friendships.
--   4. feed_subject_owner() likewise only names the owner of your own or a
--      friend's post.
--   5. Every function gets a fixed search_path, so none can be pointed at a
--      look-alike table by a caller's session settings.
--
-- What the advisor will still list, on purpose: "Signed-In Users Can Execute
-- SECURITY DEFINER Function" for the friend RPCs, export/delete, and the RLS
-- helpers. Those run with elevated rights by design so they can read a
-- friend's summary, and each checks friendship, sharing and blocks itself.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Nothing for signed-out callers
-- ---------------------------------------------------------------------------
-- Postgres also grants EXECUTE to PUBLIC by default, which anon inherits, so
-- both go; signed-in users get it explicitly.
revoke execute on function are_friends(uuid, uuid)                    from public, anon;
grant  execute on function are_friends(uuid, uuid)                    to authenticated;
revoke execute on function can_react_to(text, uuid)                   from public, anon;
grant  execute on function can_react_to(text, uuid)                   to authenticated;
revoke execute on function feed_subject_owner(text, uuid)             from public, anon;
grant  execute on function feed_subject_owner(text, uuid)             to authenticated;
revoke execute on function rpc_delete_my_account()                    from public, anon;
grant  execute on function rpc_delete_my_account()                    to authenticated;
revoke execute on function rpc_export_my_data()                       from public, anon;
grant  execute on function rpc_export_my_data()                       to authenticated;
revoke execute on function rpc_friend_feed(int, timestamptz)          from public, anon;
grant  execute on function rpc_friend_feed(int, timestamptz)          to authenticated;
revoke execute on function rpc_friend_leaderboard(timestamptz, date)  from public, anon;
grant  execute on function rpc_friend_leaderboard(timestamptz, date)  to authenticated;
revoke execute on function rpc_friend_prs(uuid)                       from public, anon;
grant  execute on function rpc_friend_prs(uuid)                       to authenticated;
revoke execute on function rpc_friend_stats(uuid, date)               from public, anon;
grant  execute on function rpc_friend_stats(uuid, date)               to authenticated;
revoke execute on function rpc_search_users(text)                     from public, anon;
grant  execute on function rpc_search_users(text)                     to authenticated;
revoke execute on function rpc_block_user(uuid)                       from public, anon;
grant  execute on function rpc_block_user(uuid)                       to authenticated;
revoke execute on function rpc_weekly_coverage(date)                  from public, anon;
grant  execute on function rpc_weekly_coverage(date)                  to authenticated;
revoke execute on function rpc_workout_summary(uuid)                  from public, anon;
grant  execute on function rpc_workout_summary(uuid)                  to authenticated;
revoke execute on function rpc_start_workout_from_template(uuid)      from public, anon;
grant  execute on function rpc_start_workout_from_template(uuid)      to authenticated;
revoke execute on function rpc_save_workout_as_template(uuid, text)   from public, anon;
grant  execute on function rpc_save_workout_as_template(uuid, text)   to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trigger functions are not an API
-- ---------------------------------------------------------------------------
revoke execute on function handle_new_user()        from public, anon, authenticated;
revoke execute on function cleanup_feed_reactions() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. are_friends: only about the caller
-- ---------------------------------------------------------------------------
create or replace function are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() in (a, b)
     and exists (
       select 1 from friendships f
       where f.status = 'accepted'
         and ((f.requester_id = a and f.addressee_id = b)
           or (f.requester_id = b and f.addressee_id = a))
     );
$$;

-- ---------------------------------------------------------------------------
-- 4. feed_subject_owner: only your own or a friend's post
-- ---------------------------------------------------------------------------
create or replace function feed_subject_owner(p_type text, p_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select owner from (
    select case p_type
      when 'workout' then
        (select w.user_id from workouts w where w.id = p_id and w.ended_at is not null)
      when 'activity' then
        (select a.user_id from activities a where a.id = p_id)
    end as owner
  ) o
  where o.owner = auth.uid() or are_friends(auth.uid(), o.owner);
$$;

-- ---------------------------------------------------------------------------
-- 5. Fixed search paths
-- ---------------------------------------------------------------------------
alter function rpc_block_user(uuid)                      set search_path = public;
alter function rpc_weekly_coverage(date)                 set search_path = public;
alter function rpc_workout_summary(uuid)                 set search_path = public;
alter function rpc_start_workout_from_template(uuid)     set search_path = public;
alter function rpc_save_workout_as_template(uuid, text)  set search_path = public;
alter function run_effort_metres(text)                   set search_path = public;
