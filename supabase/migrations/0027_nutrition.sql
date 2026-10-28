-- 0027_nutrition.sql
--
-- The food diary (1.2). Nutrition is a Pro feature (src/domain/entitlements.ts);
-- the app decides who sees it, as it does for every Pro feature, so nothing
-- here checks a subscription.
--
--  1. foods: one row per food, with the label nutrients per 100 g, per 100 ml
--     or per serving. The shared catalog is the USDA rows (no owner), loaded
--     with the service role by the import script; nobody signed in can write
--     them. Every other row is someone's own food, a recipe, or their copy of
--     an Open Food Facts product, and only they can see it.
--  2. food_portions: named portions of a food in grams ("1 cup", "1 medium").
--  3. recipe_items: a recipe's ingredients. A recipe is a food you own whose
--     nutrients are per serving, worked out by the app from these rows.
--  4. diary_entries: what you ate, by local day and meal (0 to 5). Each entry
--     keeps its own copy of the nutrients for the amount eaten, so editing or
--     deleting a food never rewrites a past day, and a day's totals are a sum.
--     Ids are made on the phone, so a replayed insert hits the primary key.
--  5. saved_meals and saved_meal_items: foods logged together in one tap,
--     copied in the same way.
--  6. diary_days: a note per day, and whether you marked it complete.
--  7. water_logs and body_weights. The latest weigh-in also becomes the
--     profile's bodyweight (in the profile's unit), which run calories and
--     bodyweight exercises already read.
--  8. nutrition_goals: dated targets. A day's goal is the latest row on or
--     before it, so past days keep the goal they had.
--  9. nutrition_settings: one row per person; everything optional.
-- 10. rpc_search_foods: word-prefix search over the catalog and your own foods.
-- 11. import_usda_foods: the catalog loader, for the service role only.
-- 12. rpc_export_my_data includes all of it, under "nutrition".
--
-- Additive only: nothing existing changes shape. Every table has Row Level
-- Security and goes with the account (on delete cascade).
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- An amount of one nutrient: unknown (null) is not the same as zero.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    where t.typname = 'nutrient_amount' and t.typnamespace = 'public'::regnamespace
  ) then
    create domain nutrient_amount as real check (value >= 0 and value < 1000000);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- foods
-- ---------------------------------------------------------------------------
create table if not exists foods (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid references auth.users (id) on delete cascade,
  source         text not null check (source in ('usda', 'off', 'user', 'recipe')),
  -- The USDA FoodData Central id, or the barcode an Open Food Facts copy came from.
  source_ref     text check (source_ref is null or char_length(source_ref) <= 40),
  barcode        text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  name           text not null check (char_length(name) between 1 and 200),
  brand          text check (brand is null or char_length(brand) <= 120),
  basis          text not null default '100g' check (basis in ('100g', '100ml', 'serving')),
  serving_label  text check (serving_label is null or char_length(serving_label) between 1 and 60),
  -- A serving's weight, and for a drink its volume, when known.
  serving_g      real check (serving_g is null or (serving_g > 0 and serving_g <= 10000)),
  serving_ml     real check (serving_ml is null or (serving_ml > 0 and serving_ml <= 10000)),
  -- Recipes only: how many servings the whole recipe makes.
  servings       real check (servings is null or (servings > 0 and servings <= 1000)),
  kcal           nutrient_amount not null,
  fat_g          nutrient_amount,
  sat_fat_g      nutrient_amount,
  trans_fat_g    nutrient_amount,
  cholesterol_mg nutrient_amount,
  sodium_mg      nutrient_amount,
  carbs_g        nutrient_amount,
  fiber_g        nutrient_amount,
  sugars_g       nutrient_amount,
  added_sugars_g nutrient_amount,
  protein_g      nutrient_amount,
  vitamin_d_mcg  nutrient_amount,
  calcium_mg     nutrient_amount,
  iron_mg        nutrient_amount,
  potassium_mg   nutrient_amount,
  -- Anything else the source lists, keyed by nutrient name with its unit.
  extra          jsonb not null default '{}'::jsonb check (jsonb_typeof(extra) = 'object'),
  search         tsvector generated always as (to_tsvector('english', name || ' ' || coalesce(brand, ''))) stored,
  created_at     timestamptz not null default now(),
  -- The shared catalog is exactly the USDA rows; everything else has an owner.
  constraint foods_shared_is_usda check ((source = 'usda') = (owner_id is null)),
  constraint foods_serving_named check (basis <> 'serving' or serving_label is not null),
  constraint foods_recipe_servings check ((source = 'recipe') = (servings is not null))
);
create unique index if not exists foods_usda_ref on foods (source_ref) where source = 'usda';
create index if not exists foods_owner_idx on foods (owner_id) where owner_id is not null;
create index if not exists foods_owner_barcode_idx on foods (owner_id, barcode) where barcode is not null;
create index if not exists foods_search_idx on foods using gin (search);

alter table foods enable row level security;
drop policy if exists foods_select on foods;
create policy foods_select on foods for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
drop policy if exists foods_insert_own on foods;
create policy foods_insert_own on foods for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists foods_update_own on foods;
create policy foods_update_own on foods for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists foods_delete_own on foods;
create policy foods_delete_own on foods for delete to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- food_portions
-- ---------------------------------------------------------------------------
create table if not exists food_portions (
  id       uuid primary key default gen_random_uuid(),
  food_id  uuid not null references foods (id) on delete cascade,
  label    text not null check (char_length(label) between 1 and 80),
  grams    real not null check (grams > 0 and grams <= 10000),
  position smallint not null default 0,
  unique (food_id, label)
);

alter table food_portions enable row level security;
drop policy if exists food_portions_select on food_portions;
create policy food_portions_select on food_portions for select to authenticated
  using (exists (
    select 1 from foods f
    where f.id = food_portions.food_id and (f.owner_id is null or f.owner_id = auth.uid())
  ));
drop policy if exists food_portions_write_own on food_portions;
create policy food_portions_write_own on food_portions for all to authenticated
  using (exists (select 1 from foods f where f.id = food_portions.food_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from foods f where f.id = food_portions.food_id and f.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- recipe_items: each keeps the nutrients for its own amount, so the recipe
-- can be worked out again (servings changed, an item removed) even after an
-- ingredient's food has been deleted.
-- ---------------------------------------------------------------------------
create table if not exists recipe_items (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references foods (id) on delete cascade,
  position       smallint not null default 0,
  food_id        uuid references foods (id) on delete set null,
  name           text not null check (char_length(name) between 1 and 200),
  amount         real not null check (amount > 0 and amount <= 100000),
  unit           text not null check (char_length(unit) between 1 and 80),
  grams          real check (grams is null or (grams > 0 and grams <= 100000)),
  kcal           nutrient_amount not null,
  fat_g          nutrient_amount,
  sat_fat_g      nutrient_amount,
  trans_fat_g    nutrient_amount,
  cholesterol_mg nutrient_amount,
  sodium_mg      nutrient_amount,
  carbs_g        nutrient_amount,
  fiber_g        nutrient_amount,
  sugars_g       nutrient_amount,
  added_sugars_g nutrient_amount,
  protein_g      nutrient_amount,
  vitamin_d_mcg  nutrient_amount,
  calcium_mg     nutrient_amount,
  iron_mg        nutrient_amount,
  potassium_mg   nutrient_amount
);
create index if not exists recipe_items_recipe_idx on recipe_items (recipe_id, position);

alter table recipe_items enable row level security;
drop policy if exists recipe_items_all_own on recipe_items;
create policy recipe_items_all_own on recipe_items for all to authenticated
  using (exists (
    select 1 from foods r where r.id = recipe_items.recipe_id and r.owner_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from foods r
      where r.id = recipe_items.recipe_id and r.owner_id = auth.uid() and r.source = 'recipe'
    )
    -- An ingredient must be a food you can see (the catalog or your own).
    and (recipe_items.food_id is null or exists (select 1 from foods f where f.id = recipe_items.food_id))
  );

-- ---------------------------------------------------------------------------
-- diary_entries
-- ---------------------------------------------------------------------------
create table if not exists diary_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  day            date not null check (day between date '2000-01-01' and date '2100-01-01'),
  meal           smallint not null check (meal between 0 and 5),
  food_id        uuid references foods (id) on delete set null,
  source         text not null check (source in ('usda', 'off', 'user', 'recipe', 'quick')),
  barcode        text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  name           text not null check (char_length(name) between 1 and 200),
  brand          text check (brand is null or char_length(brand) <= 120),
  amount         real not null check (amount > 0 and amount <= 100000),
  unit           text not null check (char_length(unit) between 1 and 80),
  grams          real check (grams is null or (grams > 0 and grams <= 100000)),
  kcal           nutrient_amount not null,
  fat_g          nutrient_amount,
  sat_fat_g      nutrient_amount,
  trans_fat_g    nutrient_amount,
  cholesterol_mg nutrient_amount,
  sodium_mg      nutrient_amount,
  carbs_g        nutrient_amount,
  fiber_g        nutrient_amount,
  sugars_g       nutrient_amount,
  added_sugars_g nutrient_amount,
  protein_g      nutrient_amount,
  vitamin_d_mcg  nutrient_amount,
  calcium_mg     nutrient_amount,
  iron_mg        nutrient_amount,
  potassium_mg   nutrient_amount,
  logged_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists diary_entries_user_day_idx on diary_entries (user_id, day);
create index if not exists diary_entries_user_logged_idx on diary_entries (user_id, logged_at desc);

alter table diary_entries enable row level security;
drop policy if exists diary_entries_all_own on diary_entries;
create policy diary_entries_all_own on diary_entries for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (diary_entries.food_id is null or exists (select 1 from foods f where f.id = diary_entries.food_id))
  );

-- ---------------------------------------------------------------------------
-- saved_meals
-- ---------------------------------------------------------------------------
create table if not exists saved_meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists saved_meals_user_idx on saved_meals (user_id);

alter table saved_meals enable row level security;
drop policy if exists saved_meals_all_own on saved_meals;
create policy saved_meals_all_own on saved_meals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists saved_meal_items (
  id             uuid primary key default gen_random_uuid(),
  saved_meal_id  uuid not null references saved_meals (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  position       smallint not null default 0,
  food_id        uuid references foods (id) on delete set null,
  source         text not null check (source in ('usda', 'off', 'user', 'recipe', 'quick')),
  barcode        text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  name           text not null check (char_length(name) between 1 and 200),
  brand          text check (brand is null or char_length(brand) <= 120),
  amount         real not null check (amount > 0 and amount <= 100000),
  unit           text not null check (char_length(unit) between 1 and 80),
  grams          real check (grams is null or (grams > 0 and grams <= 100000)),
  kcal           nutrient_amount not null,
  fat_g          nutrient_amount,
  sat_fat_g      nutrient_amount,
  trans_fat_g    nutrient_amount,
  cholesterol_mg nutrient_amount,
  sodium_mg      nutrient_amount,
  carbs_g        nutrient_amount,
  fiber_g        nutrient_amount,
  sugars_g       nutrient_amount,
  added_sugars_g nutrient_amount,
  protein_g      nutrient_amount,
  vitamin_d_mcg  nutrient_amount,
  calcium_mg     nutrient_amount,
  iron_mg        nutrient_amount,
  potassium_mg   nutrient_amount
);
create index if not exists saved_meal_items_meal_idx on saved_meal_items (saved_meal_id, position);

alter table saved_meal_items enable row level security;
drop policy if exists saved_meal_items_all_own on saved_meal_items;
create policy saved_meal_items_all_own on saved_meal_items for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from saved_meals m where m.id = saved_meal_items.saved_meal_id and m.user_id = auth.uid()
    )
    and (saved_meal_items.food_id is null or exists (select 1 from foods f where f.id = saved_meal_items.food_id))
  );

-- ---------------------------------------------------------------------------
-- diary_days
-- ---------------------------------------------------------------------------
create table if not exists diary_days (
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null check (day between date '2000-01-01' and date '2100-01-01'),
  note         text check (note is null or char_length(note) <= 2000),
  completed_at timestamptz,
  primary key (user_id, day)
);

alter table diary_days enable row level security;
drop policy if exists diary_days_all_own on diary_days;
create policy diary_days_all_own on diary_days for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- water_logs
-- ---------------------------------------------------------------------------
create table if not exists water_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  day       date not null check (day between date '2000-01-01' and date '2100-01-01'),
  ml        int not null check (ml > 0 and ml <= 5000),
  logged_at timestamptz not null default now()
);
create index if not exists water_logs_user_day_idx on water_logs (user_id, day);

alter table water_logs enable row level security;
drop policy if exists water_logs_all_own on water_logs;
create policy water_logs_all_own on water_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- body_weights: one weigh-in per day; a second one that day replaces it.
-- ---------------------------------------------------------------------------
create table if not exists body_weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  measured_on date not null check (measured_on between date '2000-01-01' and date '2100-01-01'),
  -- The same bounds as run calories (src/domain/running/calories.ts).
  kg          real not null check (kg >= 20 and kg <= 400),
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

alter table body_weights enable row level security;
drop policy if exists body_weights_all_own on body_weights;
create policy body_weights_all_own on body_weights for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The latest weigh-in becomes the profile's bodyweight, in the profile's unit
-- (profiles.body_weight is stored in lb or kg, as the person chose). Removing
-- every weigh-in leaves the profile as it was. Runs as the person, so the
-- profiles policy still applies.
create or replace function sync_profile_body_weight()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
  v_kg   real;
begin
  select b.kg into v_kg
  from body_weights b
  where b.user_id = v_user
  order by b.measured_on desc
  limit 1;

  if v_kg is not null then
    update profiles p
    set body_weight = round((case p.unit when 'lb' then v_kg * 2.20462 else v_kg end)::numeric, 1)
    where p.user_id = v_user;
  end if;
  return null;
end $$;

revoke execute on function sync_profile_body_weight() from public, anon, authenticated;

drop trigger if exists body_weights_sync_profile on body_weights;
create trigger body_weights_sync_profile
  after insert or update or delete on body_weights
  for each row execute function sync_profile_body_weight();

-- ---------------------------------------------------------------------------
-- nutrition_goals
-- ---------------------------------------------------------------------------
create table if not exists nutrition_goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  starts_on  date not null check (starts_on between date '2000-01-01' and date '2100-01-01'),
  kcal       int not null check (kcal between 0 and 20000),
  protein_g  real check (protein_g is null or (protein_g >= 0 and protein_g <= 2000)),
  carbs_g    real check (carbs_g is null or (carbs_g >= 0 and carbs_g <= 2000)),
  fat_g      real check (fat_g is null or (fat_g >= 0 and fat_g <= 2000)),
  -- Whether the person set the macros as percentages or grams; grams are stored either way.
  macro_mode text not null default 'percent' check (macro_mode in ('percent', 'grams')),
  -- Other targets, keyed like the nutrient columns: {"fiber_g": 30, "sodium_mg": 2300}.
  targets    jsonb not null default '{}'::jsonb check (jsonb_typeof(targets) = 'object'),
  -- Optional share of the day's calories per meal, in meal order.
  meal_split jsonb check (meal_split is null or jsonb_typeof(meal_split) = 'array'),
  created_at timestamptz not null default now(),
  unique (user_id, starts_on)
);

alter table nutrition_goals enable row level security;
drop policy if exists nutrition_goals_all_own on nutrition_goals;
create policy nutrition_goals_all_own on nutrition_goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- nutrition_settings
-- ---------------------------------------------------------------------------
create table if not exists nutrition_settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  meal_names         text[] not null default array['Breakfast', 'Lunch', 'Dinner', 'Snacks']
                     check (cardinality(meal_names) between 1 and 6
                            and array_position(meal_names, null) is null
                            and char_length(array_to_string(meal_names, '')) <= 180),
  energy_unit        text not null default 'kcal' check (energy_unit in ('kcal', 'kj')),
  add_exercise       boolean not null default true,
  net_carbs          boolean not null default false,
  water_goal_ml      int check (water_goal_ml is null or water_goal_ml between 250 and 10000),
  -- The goal calculator's inputs. None is needed to log food.
  height_cm          real check (height_cm is null or height_cm between 50 and 272),
  birth_year         smallint check (birth_year is null or birth_year between 1900 and 2100),
  sex_for_calculator text check (sex_for_calculator is null or sex_for_calculator in ('female', 'male')),
  activity_level     text check (activity_level is null
                                 or activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal_weight_kg     real check (goal_weight_kg is null or goal_weight_kg between 20 and 400),
  weekly_change_kg   real check (weekly_change_kg is null or weekly_change_kg between -1 and 1),
  updated_at         timestamptz not null default now()
);

alter table nutrition_settings enable row level security;
drop policy if exists nutrition_settings_all_own on nutrition_settings;
create policy nutrition_settings_all_own on nutrition_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nothing here is for signed-out callers; RLS already returns them nothing.
revoke all on foods, food_portions, recipe_items, diary_entries, saved_meals, saved_meal_items,
  diary_days, water_logs, body_weights, nutrition_goals, nutrition_settings from anon;

-- ---------------------------------------------------------------------------
-- rpc_search_foods: every word must start a word in the name or brand
-- ("chick bre" finds "Chicken breast"). Your own foods come first, then
-- names that start with the first word typed, then shorter names, which in
-- the USDA catalog are the plain foods: "banana" puts "Banana, raw" ahead of
-- "SILK Banana-Strawberry soy yogurt". Runs as the caller, so RLS limits it
-- to the catalog and your own foods.
-- ---------------------------------------------------------------------------
create or replace function rpc_search_foods(p_query text, p_limit int default 25)
returns setof foods
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_words text[];
  v_query tsquery;
begin
  if auth.uid() is null then
    raise exception 'Sign in to search foods.' using errcode = '42501';
  end if;

  v_words := array_remove(regexp_split_to_array(
    lower(regexp_replace(left(coalesce(p_query, ''), 100), '[^[:alnum:]]+', ' ', 'g')), ' '), '');
  if cardinality(v_words) = 0 then
    return;
  end if;
  v_query := to_tsquery('english',
    (select string_agg(w || ':*', ' & ') from unnest(v_words) w));
  -- Only stop words ("the", "and"): nothing to search for.
  if numnode(v_query) = 0 then
    return;
  end if;

  return query
    select f.*
    from foods f
    where f.search @@ v_query
    order by (f.owner_id is not null) desc,
             (lower(f.name) like v_words[1] || '%') desc,
             char_length(f.name),
             ts_rank(f.search, v_query) desc,
             f.name
    limit least(greatest(coalesce(p_limit, 25), 1), 50);
end $$;

revoke execute on function rpc_search_foods(text, int) from public, anon;
grant  execute on function rpc_search_foods(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- import_usda_foods: the catalog loader, for scripts/import-usda.js with the
-- service role only. Takes rows as scripts/usda.js makes them (the foods
-- columns plus a "portions" list) and upserts by USDA id, replacing each
-- food's portions. Diary entries keep their own copies, so reloading the
-- catalog never changes a past day. Catalog foods are never deleted here:
-- an entry's food_id would quietly become empty.
-- ---------------------------------------------------------------------------
create or replace function import_usda_foods(p_foods jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r    jsonb;
  f    foods;
  v_id uuid;
  v_n  int := 0;
begin
  if jsonb_typeof(p_foods) <> 'array' then
    raise exception 'Expected a list of foods.';
  end if;

  for r in select value from jsonb_array_elements(p_foods) loop
    f := jsonb_populate_record(null::foods, r - 'portions' - 'search');
    if f.source_ref is null or f.source_ref !~ '^[0-9]{1,12}$' then
      raise exception 'Every USDA food needs its FoodData Central id.';
    end if;

    insert into foods (
      source, source_ref, name, basis, kcal, fat_g, sat_fat_g, trans_fat_g, cholesterol_mg, sodium_mg,
      carbs_g, fiber_g, sugars_g, added_sugars_g, protein_g, vitamin_d_mcg, calcium_mg, iron_mg,
      potassium_mg, extra
    ) values (
      'usda', f.source_ref, f.name, '100g', f.kcal, f.fat_g, f.sat_fat_g, f.trans_fat_g, f.cholesterol_mg,
      f.sodium_mg, f.carbs_g, f.fiber_g, f.sugars_g, f.added_sugars_g, f.protein_g, f.vitamin_d_mcg,
      f.calcium_mg, f.iron_mg, f.potassium_mg, coalesce(f.extra, '{}'::jsonb)
    )
    on conflict (source_ref) where source = 'usda' do update set
      name = excluded.name, kcal = excluded.kcal, fat_g = excluded.fat_g, sat_fat_g = excluded.sat_fat_g,
      trans_fat_g = excluded.trans_fat_g, cholesterol_mg = excluded.cholesterol_mg,
      sodium_mg = excluded.sodium_mg, carbs_g = excluded.carbs_g, fiber_g = excluded.fiber_g,
      sugars_g = excluded.sugars_g, added_sugars_g = excluded.added_sugars_g, protein_g = excluded.protein_g,
      vitamin_d_mcg = excluded.vitamin_d_mcg, calcium_mg = excluded.calcium_mg, iron_mg = excluded.iron_mg,
      potassium_mg = excluded.potassium_mg, extra = excluded.extra
    returning id into v_id;

    delete from food_portions where food_id = v_id;
    insert into food_portions (food_id, label, grams, position)
    select v_id, p.value ->> 'label', (p.value ->> 'grams')::real, (p.ordinality - 1)::smallint
    from jsonb_array_elements(coalesce(r -> 'portions', '[]'::jsonb)) with ordinality as p(value, ordinality);

    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke execute on function import_usda_foods(jsonb) from public, anon, authenticated;
grant  execute on function import_usda_foods(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- "Download my data": as in 0026, plus the food diary under "nutrition".
-- ---------------------------------------------------------------------------
create or replace function rpc_export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'account', (
      select jsonb_build_object('email', u.email, 'created_at', u.created_at)
      from auth.users u where u.id = uid
    ),
    'profile',     (select to_jsonb(p) from profiles p where p.user_id = uid),
    'workouts',    (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from workouts w where w.user_id = uid),
    'sets',        (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from sets s where s.user_id = uid),
    'activities',  (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from activities a where a.user_id = uid),
    'rest_days',   (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from rest_days r where r.user_id = uid),
    'templates',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from workout_templates t where t.user_id = uid),
    'planned',     (select coalesce(jsonb_agg(to_jsonb(pl)), '[]'::jsonb) from planned_sessions pl where pl.user_id = uid),
    'machines',    (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from machines m where m.user_id = uid),
    'gyms',        (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from gyms g where g.user_id = uid),
    'custom_exercises', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from exercises e where e.user_id = uid),
    'friendships', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from friendships f
                    where f.requester_id = uid or f.addressee_id = uid),
    'blocks',      (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from user_blocks b where b.blocker_id = uid),
    'badges',      (select coalesce(jsonb_agg(to_jsonb(pb)), '[]'::jsonb) from profile_badges pb where pb.user_id = uid),
    'reactions',   (select coalesce(jsonb_agg(to_jsonb(fr)), '[]'::jsonb) from feed_reactions fr where fr.user_id = uid),
    -- Running (0015 onwards). Routes come out as GeoJSON, which any mapping
    -- tool can open (longitude, latitude, altitude in metres), with the
    -- seconds from the start at each point alongside as route_times.
    'runs',        (select coalesce(jsonb_agg(
                      (to_jsonb(rn) - 'route')
                      || jsonb_build_object('route', case when rn.route is null then null
                                                          else ST_AsGeoJSON(rn.route)::jsonb end)
                      || jsonb_build_object('route_times', (
                           select array_agg(ST_M(dp.geom)::int order by dp.path[1])
                           from ST_DumpPoints(rn.route) dp))
                    ), '[]'::jsonb) from runs rn where rn.user_id = uid),
    'run_best_efforts', (select coalesce(jsonb_agg(to_jsonb(be)), '[]'::jsonb) from run_best_efforts be where be.user_id = uid),
    'run_privacy_zones', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', z.id, 'label', z.label, 'radius_m', z.radius_m, 'created_at', z.created_at,
                      'lat', ST_Y(z.center::geometry), 'lon', ST_X(z.center::geometry)
                    )), '[]'::jsonb) from run_privacy_zones z where z.user_id = uid),
    'saved_routes', (select coalesce(jsonb_agg(
                      (to_jsonb(sr) - 'route') || jsonb_build_object('route', ST_AsGeoJSON(sr.route)::jsonb)
                    ), '[]'::jsonb) from saved_routes sr where sr.user_id = uid),
    'run_preferences', (select to_jsonb(rp) from run_preferences rp where rp.user_id = uid),
    -- Daily step totals, only ever uploaded while sharing them is on (0024).
    'daily_steps', (select coalesce(jsonb_agg(to_jsonb(ds) order by ds.day), '[]'::jsonb)
                    from daily_steps ds where ds.user_id = uid),
    -- Rust Strength Pro, as last reported by RevenueCat (0026). RevenueCat
    -- and Apple keep their own purchase records.
    'subscription', (select to_jsonb(sb) from subscriptions sb where sb.user_id = uid),
    -- The food diary (0027). Your own foods and recipes only, not the shared
    -- USDA catalog, and without the search index.
    'nutrition', jsonb_build_object(
      'settings',      (select to_jsonb(ns) from nutrition_settings ns where ns.user_id = uid),
      'goals',         (select coalesce(jsonb_agg(to_jsonb(g) order by g.starts_on), '[]'::jsonb)
                        from nutrition_goals g where g.user_id = uid),
      'foods',         (select coalesce(jsonb_agg(to_jsonb(f) - 'search' order by f.created_at), '[]'::jsonb)
                        from foods f where f.owner_id = uid),
      'food_portions', (select coalesce(jsonb_agg(to_jsonb(fp)), '[]'::jsonb)
                        from food_portions fp join foods f on f.id = fp.food_id where f.owner_id = uid),
      'recipe_items',  (select coalesce(jsonb_agg(to_jsonb(ri) order by ri.recipe_id, ri.position), '[]'::jsonb)
                        from recipe_items ri join foods r on r.id = ri.recipe_id where r.owner_id = uid),
      'diary_entries', (select coalesce(jsonb_agg(to_jsonb(e) order by e.day, e.logged_at), '[]'::jsonb)
                        from diary_entries e where e.user_id = uid),
      'diary_days',    (select coalesce(jsonb_agg(to_jsonb(d) order by d.day), '[]'::jsonb)
                        from diary_days d where d.user_id = uid),
      'saved_meals',   (select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object('items', (
                          select coalesce(jsonb_agg(to_jsonb(i) order by i.position), '[]'::jsonb)
                          from saved_meal_items i where i.saved_meal_id = m.id))), '[]'::jsonb)
                        from saved_meals m where m.user_id = uid),
      'water_logs',    (select coalesce(jsonb_agg(to_jsonb(w) order by w.logged_at), '[]'::jsonb)
                        from water_logs w where w.user_id = uid),
      'body_weights',  (select coalesce(jsonb_agg(to_jsonb(b) order by b.measured_on), '[]'::jsonb)
                        from body_weights b where b.user_id = uid)
    )
  ) into result;

  return result;
end $$;

revoke all on function rpc_export_my_data() from public, anon;
grant execute on function rpc_export_my_data() to authenticated;
