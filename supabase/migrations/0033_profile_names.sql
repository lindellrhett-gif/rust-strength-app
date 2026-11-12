-- 0033_profile_names.sql
--
-- Part one of a SECURITY FIX (part two is 0034). Found on November 7, 2026,
-- while writing legal/RECORDS_OF_PROCESSING.md.
--
-- The profiles policy from migration 0002 lets anyone in a friendship row
-- with you, accepted or only pending, read your whole profile row through the
-- API. That includes body_weight, which the Privacy Policy says nobody else
-- can see, and a stranger only has to send you a friend request to get it.
-- The app shows none of it: it reads only the username and display name.
--
-- Postgres can't hide one column of somebody else's row, so the fix is in two
-- steps. This one adds a function that returns just the names, for the
-- people you have a friendship row with. Version 1.2 reads names through it.
-- Additive, so safe to apply as soon as you OK it. 0034 then limits the
-- profiles table to its owner, on 1.2's release day.

create or replace function rpc_profile_names(p_ids uuid[])
returns table (user_id uuid, username text, display_name text)
language sql
security definer
set search_path = public
stable
as $$
  select p.user_id, p.username, p.display_name
  from profiles p
  where p.user_id = any(p_ids)
    and exists (
      select 1 from friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = p.user_id)
         or (f.addressee_id = auth.uid() and f.requester_id = p.user_id)
    );
$$;
revoke execute on function rpc_profile_names(uuid[]) from public, anon;
grant execute on function rpc_profile_names(uuid[]) to authenticated;
