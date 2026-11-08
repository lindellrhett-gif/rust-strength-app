-- 0031_private_sharing_default.sql
--
-- New accounts start with "Show my sessions in the feed" off.
--
-- Quebec's Law 25 (s 9.1) requires the most private settings by default, and
-- the UK Children's Code (standard 7) asks for high-privacy defaults. Version
-- 1.2 asks once, when someone has their first accepted friend, whether to
-- share (see 0030 and src/domain/sharePrompt.ts).
--
-- Existing accounts keep whatever they have. Only the column default changes,
-- so profiles created from now on start private; the sign-up trigger
-- (handle_new_user, last in 0028) does not set the column and takes the
-- default.
--
-- APPLY ON 1.2 RELEASE DAY, NOT BEFORE. Version 1.1 has no prompt, so a new
-- 1.1 account would start private with nothing telling it how to share.
--
-- The update repeats 0030's, for anyone who turned sharing off in 1.1 between
-- the two migrations.

update profiles
   set share_choice_at = now()
 where share_workouts = false
   and share_choice_at is null;

alter table profiles alter column share_workouts set default false;
