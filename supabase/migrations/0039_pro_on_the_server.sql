-- 0039_pro_on_the_server.sql
--
-- SECURITY FIX from the November 23, 2026 audit: the server, not only the
-- app, requires Pro to save to the food diary.
--
-- The app hides the diary without Pro, but the tables took writes from any
-- signed-in account, so someone calling the API directly could use the diary
-- without paying. Now adding or changing anything in the diary needs an
-- active row in public.subscriptions (kept by the revenuecat-webhook and
-- sync-subscription functions). Reading, deleting and exporting stay open:
-- someone whose Pro has ended can still see, delete and download what they
-- logged, and deleting the account still removes it all.
--
-- The checks are restrictive policies, so they narrow the existing ones
-- rather than replacing them: an entry still has to be your own as well.
--
-- APPLY ONLY AFTER the app build that calls sync-subscription is live, and
-- after sync-subscription is deployed (store/RELEASE notes). Before then, an
-- entry saved in the seconds between buying Pro and the webhook arriving is
-- refused. Development builds use RevenueCat's Test Store, which the server
-- never sees, so a dev account needs a subscriptions row added by hand to
-- test the diary once this is on.

create schema if not exists private;

-- has_pro for the person asking, for the policies below. has_pro itself takes
-- any account id, so it stays out of reach.
create or replace function private.i_have_pro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_pro(auth.uid())
$$;
revoke all on function private.i_have_pro() from public, anon;
grant execute on function private.i_have_pro() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'diary_entries', 'diary_days', 'nutrition_goals', 'nutrition_settings', 'water_logs',
    'saved_meals', 'saved_meal_items', 'foods', 'recipe_items', 'food_portions', 'body_weights'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_pro_insert', t);
    execute format('drop policy if exists %I on %I', t || '_pro_update', t);
    execute format(
      'create policy %I on %I as restrictive for insert to authenticated with check (private.i_have_pro())',
      t || '_pro_insert', t
    );
    execute format(
      'create policy %I on %I as restrictive for update to authenticated using (true) with check (private.i_have_pro())',
      t || '_pro_update', t
    );
  end loop;
end $$;
