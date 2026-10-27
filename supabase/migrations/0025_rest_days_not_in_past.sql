-- 0025_rest_days_not_in_past.sql
--
-- *** APPLY WHEN VERSION 1.1 IS RELEASED, NOT BEFORE. ***
--
-- A rest day keeps a streak alive, so marking one after the fact could rescue
-- a streak that was really broken. From 1.1 a rest day can be planned for
-- today or a day ahead, never for a day that has passed; the app stops
-- offering it, and this refuses it from anywhere else.
--
-- Version 1.0 still offers past rest days, so applied early this would turn
-- that button into an error for everyone who hasn't updated. Apply it with
-- 0020 on release day.
--
-- "Today" depends on the time zone and the server doesn't know the runner's,
-- so the earliest date that is still today anywhere on Earth (UTC-12) is the
-- limit. Removing a rest day, past or future, is unaffected.

create or replace function rest_day_not_in_past()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.rest_date < ((now() at time zone 'utc') - interval '12 hours')::date then
    raise exception 'A rest day can be today or a day ahead, not a day that has passed.';
  end if;
  return new;
end $$;

revoke all on function rest_day_not_in_past() from public, anon, authenticated;

drop trigger if exists rest_days_not_in_past on rest_days;
create trigger rest_days_not_in_past
  before insert or update of rest_date on rest_days
  for each row execute function rest_day_not_in_past();
