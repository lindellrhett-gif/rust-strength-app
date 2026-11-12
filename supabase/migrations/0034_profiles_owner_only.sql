-- 0034_profiles_owner_only.sql
--
-- Part two of the SECURITY FIX in 0033: from now on only you can read your
-- profile row. Friends and people with a pending request get names through
-- rpc_profile_names, and everything else they see (stats, personal bests,
-- the feed, the leaderboard, search) already comes through functions that
-- choose their own columns.
--
-- APPLY ON 1.2 RELEASE DAY, after 0033. The 1.1 app reads friends' names
-- straight from this table, so on 1.1 the Friends list shows "unknown"
-- instead of names until the person updates. That is the cost of closing
-- the bodyweight leak; the alternative is leaving it open.

drop policy if exists profiles_select_self_or_friend on profiles;
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select using (user_id = auth.uid());
