-- 0030_share_choice.sql
--
-- Records when someone chose whether to share their sessions with friends.
--
-- From 1.2, sharing starts off for new accounts (migration 0031) and the app
-- asks once, when the person has their first accepted friend. This column is
-- how it knows they have answered: the prompt shows only while it is null and
-- sharing is off. The Profile switch sets it too.
--
-- Accounts that have sharing off today turned it off themselves, since the
-- default was on, so they count as having chosen and are never asked.
--
-- Additive: version 1.1 neither reads nor writes the column. Safe to apply
-- before 1.2 is released, and needed before 1.2 builds are tested.

alter table profiles add column if not exists share_choice_at timestamptz;

comment on column profiles.share_choice_at is
  'When the person last chose whether to share sessions with friends, from the app''s first-friend prompt or the Profile switch. Null: never asked.';

update profiles
   set share_choice_at = now()
 where share_workouts = false
   and share_choice_at is null;
