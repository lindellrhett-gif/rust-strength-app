-- 0028_signup_unit.sql
--
-- A new account starts in the units of the phone it signs up on. From 1.2 the
-- app reads the phone's region settings and sends the weight unit ('lb' or
-- 'kg') in the sign-up request's user metadata, beside the consent from
-- migration 0011, and the trigger that creates the profile uses it. Run
-- distance follows the weight unit in the app, so kilograms also means
-- kilometres.
--
-- Additive: version 1.1 sends no unit, and anything other than 'kg' starts the
-- profile in pounds, as before. Safe to apply before 1.2 is released.
--
-- The same function as 0011 apart from the unit.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  tries int := 0;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  accepted_version text := nullif(meta ->> 'terms_version', '');
  age_ok boolean := coalesce((meta ->> 'age_confirmed')::boolean, false);
  start_unit weight_unit := case when meta ->> 'unit' = 'kg' then 'kg'::weight_unit else 'lb'::weight_unit end;
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

  insert into profiles (
    user_id, username, display_name, username_chosen,
    terms_accepted_at, terms_version, age_confirmed_at, unit
  )
  values (
    new.id, candidate, null, false,
    case when accepted_version is not null then now() end,
    accepted_version,
    case when age_ok then now() end,
    start_unit
  );
  return new;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;
