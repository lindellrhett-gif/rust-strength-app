-- 0029_sign_in_minimum.sql
--
-- Sign in with Apple and Google (1.2). Supabase Auth keeps whatever profile
-- the provider's token carries: from Google that is the person's name and a
-- link to their profile picture, copied into auth.users.raw_user_meta_data
-- and auth.identities.identity_data at every sign-in. The app uses neither,
-- so these triggers drop them before they are stored, and an account holds
-- only what an email sign-up holds: the email address, plus the provider's
-- account id that Supabase needs to recognise the person next time. (Apple's
-- token carries no name, and the app asks Apple for the email address only.)
--
-- Kept: iss, sub, provider_id, email, email_verified, phone_verified and
-- custom_claims, which Supabase uses to match identities, and everything the
-- app itself sends at sign-up (terms_version, age_confirmed, unit).
--
-- Additive: email sign-ups carry none of these keys, so 1.0 and 1.1 are
-- unaffected. Safe to re-run.

create or replace function strip_sign_in_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  profile_keys constant text[] := array[
    'name', 'full_name', 'given_name', 'family_name', 'middle_name', 'nickname',
    'preferred_username', 'user_name', 'picture', 'avatar_url', 'profile',
    'website', 'gender', 'birthdate', 'zoneinfo', 'locale'
  ];
begin
  if tg_table_name = 'identities' then
    if new.identity_data is not null then
      new.identity_data := new.identity_data - profile_keys;
    end if;
  elsif new.raw_user_meta_data is not null then
    new.raw_user_meta_data := new.raw_user_meta_data - profile_keys;
  end if;
  return new;
end $$;

revoke execute on function strip_sign_in_profile() from public, anon, authenticated;

drop trigger if exists strip_sign_in_profile on auth.users;
create trigger strip_sign_in_profile
  before insert or update of raw_user_meta_data on auth.users
  for each row execute function strip_sign_in_profile();

drop trigger if exists strip_sign_in_profile on auth.identities;
create trigger strip_sign_in_profile
  before insert or update of identity_data on auth.identities
  for each row execute function strip_sign_in_profile();
