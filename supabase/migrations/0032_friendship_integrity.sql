-- 0032_friendship_integrity.sql
--
-- A SECURITY FIX. Found on November 7, 2026, while writing the UK Online
-- Safety Act assessment (legal/UK_ONLINE_SAFETY.md). The friendship policies
-- from migration 0002 trusted the client too far. Anyone calling the API
-- directly, not through the app, could:
--
-- 1. insert a friendship that was already 'accepted', making themselves
--    someone's friend without that person agreeing, and so see their stats,
--    personal bests, feed and any run maps shared with friends;
-- 2. accept their own request, since either side could update the row, with
--    the same result;
-- 3. rewrite a row's requester or addressee, moving a friendship onto
--    someone else;
-- 4. send a friend request to, or from, someone who had blocked them. The
--    0007 comment said blocked users "cannot send requests", but nothing
--    enforced it.
--
-- The app itself never did any of these: it inserts pending requests and lets
-- the addressee accept them. So the fix changes nothing for the app, 1.1
-- included. Safe to apply as soon as you OK it.
--
-- Not fixed here: friendships already created this way can't be told apart
-- from real ones. Rows where the requester accepted their own request leave
-- responded_at empty or set by the requester; nothing records which.

-- True when either user has blocked the other. SECURITY DEFINER because
-- user_blocks only lets a blocker read their own rows, and the check has to
-- see a block made by the other person too.
create or replace function blocked_either_way(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from user_blocks ub
    where (ub.blocker_id = a and ub.blocked_id = b)
       or (ub.blocker_id = b and ub.blocked_id = a)
  );
$$;
revoke execute on function blocked_either_way(uuid, uuid) from public, anon;
grant execute on function blocked_either_way(uuid, uuid) to authenticated;

-- A request is always created pending, by its requester, to someone else,
-- and never across a block.
drop policy if exists friendships_insert on friendships;
create policy friendships_insert on friendships
  for insert with check (
    requester_id = auth.uid()
    and addressee_id <> auth.uid()
    and status = 'pending'
    and responded_at is null
    and not blocked_either_way(requester_id, addressee_id)
  );

-- Only the addressee may answer, only a pending request, and only by
-- accepting it (declining deletes the row, which friendships_delete allows
-- either side). Removing a friend is also a delete.
drop policy if exists friendships_update on friendships;
create policy friendships_update on friendships
  for update
  using (addressee_id = auth.uid() and status = 'pending')
  with check (addressee_id = auth.uid() and status = 'accepted');

-- And an answer can change only the status and when it was given, never who
-- the friendship is between.
revoke update on friendships from anon, authenticated;
grant update (status, responded_at) on friendships to authenticated;
