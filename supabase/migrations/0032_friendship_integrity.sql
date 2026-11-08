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
-- included. Hardened after an adversarial review the same day: accepting also
-- checks blocks, any block removes the friendship however it is written, the
-- server stamps when a request was accepted, and the block check is out of
-- the API's reach.
--
-- Not fixable here: requests or friendships created by abusing 1–3 before
-- this migration can't be told apart from real ones, except rows across a
-- block, which are always illegitimate and are deleted below. On the live
-- database on November 7, 2026 there were no blocks, so that delete removed
-- nothing; 7 pending requests and 14 friendships were left as they were.

-- --- The block check, kept out of the API --------------------------------
-- In a schema PostgREST doesn't expose, so nobody can call it to find out
-- whether a particular person has blocked them. Signed-in users need USAGE
-- and EXECUTE only so the friendship policies below can call it.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- True when either user has blocked the other. SECURITY DEFINER because
-- user_blocks only lets a blocker read their own rows, and the check has to
-- see a block made by the other person too. Like are_friends (0016), it only
-- answers about the caller.
create or replace function private.blocked_either_way(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() in (a, b)
     and exists (
       select 1 from user_blocks ub
       where (ub.blocker_id = a and ub.blocked_id = b)
          or (ub.blocker_id = b and ub.blocked_id = a)
     );
$$;
revoke execute on function private.blocked_either_way(uuid, uuid) from public, anon;
grant execute on function private.blocked_either_way(uuid, uuid) to authenticated;

-- An earlier draft of this migration put it in public; make sure it isn't.
drop function if exists public.blocked_either_way(uuid, uuid);

-- --- Who can create and answer a request ---------------------------------
-- A request is always created pending, by its requester, to someone else,
-- and never across a block.
drop policy if exists friendships_insert on friendships;
create policy friendships_insert on friendships
  for insert with check (
    requester_id = auth.uid()
    and addressee_id <> auth.uid()
    and status = 'pending'
    and responded_at is null
    and not private.blocked_either_way(requester_id, addressee_id)
  );

-- Only the addressee may answer, only a pending request, only by accepting
-- it, and not across a block (declining deletes the row, which
-- friendships_delete allows either side). Removing a friend is also a delete.
drop policy if exists friendships_update on friendships;
create policy friendships_update on friendships
  for update
  using (addressee_id = auth.uid() and status = 'pending')
  with check (
    addressee_id = auth.uid()
    and status = 'accepted'
    and not private.blocked_either_way(requester_id, addressee_id)
  );

-- An answer can change only the status and when it was given, never who the
-- friendship is between.
revoke update on friendships from anon, authenticated;
grant update (status, responded_at) on friendships to authenticated;

-- And the server, not the client, records when a request was accepted. The
-- app still sends responded_at; this overrides whatever it sends.
create or replace function stamp_friendship_response()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    new.responded_at := now();
  end if;
  return new;
end $$;
revoke execute on function stamp_friendship_response() from public, anon, authenticated;
drop trigger if exists friendships_stamp_response on friendships;
create trigger friendships_stamp_response
  before update on friendships
  for each row execute function stamp_friendship_response();

-- --- A block always ends the friendship ----------------------------------
-- rpc_block_user (0007) deletes the friendship itself, but a block written
-- straight into user_blocks didn't. Now any new or changed block does.
create or replace function teardown_blocked_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from friendships
   where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
      or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return new;
end $$;
revoke execute on function teardown_blocked_friendship() from public, anon, authenticated;
drop trigger if exists user_blocks_teardown on user_blocks;
create trigger user_blocks_teardown
  after insert or update of blocker_id, blocked_id on user_blocks
  for each row execute function teardown_blocked_friendship();

-- --- Clean up what the old rules let through -----------------------------
-- A friendship or request between two people where one has blocked the
-- other is never legitimate: blocking has always deleted it.
delete from friendships f
 where exists (
   select 1 from user_blocks b
    where (b.blocker_id = f.requester_id and b.blocked_id = f.addressee_id)
       or (b.blocker_id = f.addressee_id and b.blocked_id = f.requester_id)
 );
