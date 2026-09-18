-- Rust Strength — exercise types, a full exercise catalog, more activities,
-- and consent captured at sign-up.
--
--   1. Exercises get a load type:
--        weighted   — the weight entered is the load (bench press)
--        bodyweight — progress is more reps; weight can optionally be added
--                     (push-ups, pull-ups, dips)
--        assisted   — the weight entered is assistance, subtracted from
--                     bodyweight (assisted pull-up machine, bands)
--   2. Sets remember what was entered. `weight` stays the load actually moved,
--      so volume, records, e1RM and every existing stat query stay correct:
--        assisted:   weight = bodyweight - assist_weight
--        bodyweight: weight = bodyweight + added_weight
--   3. The library grows from 48 exercises to a full catalog.
--   4. Activity kinds for pickleball and other sports.
--   5. Terms and age confirmation recorded when the account is created, from
--      the sign-up request itself. Previously they were recorded only after an
--      automatic sign-in, which fails while an email is unconfirmed — so every
--      account made with email confirmation on had no consent record.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Load type
-- ---------------------------------------------------------------------------
do $$ begin
  create type exercise_load_type as enum ('weighted', 'bodyweight', 'assisted');
exception when duplicate_object then null;
end $$;

alter table exercises
  add column if not exists load_type exercise_load_type not null default 'weighted';

-- ---------------------------------------------------------------------------
-- 2. What the user entered, alongside the load moved
-- ---------------------------------------------------------------------------
alter table sets add column if not exists assist_weight double precision
  check (assist_weight is null or assist_weight >= 0);
alter table sets add column if not exists added_weight double precision
  check (added_weight is null or added_weight >= 0);

-- ---------------------------------------------------------------------------
-- 3. Catalog. Existing library rows are left alone by the insert (the unique
--    name index makes it a no-op for them) and corrected by the updates below.
-- ---------------------------------------------------------------------------
insert into exercises (user_id, name, muscle_group, equipment, load_type, is_custom)
select null, v.name, v.muscle_group::muscle_group, v.equipment::equipment_kind,
       v.load_type::exercise_load_type, false
from (values
  -- Chest
  ('Barbell Bench Press',              'chest',      'barbell',    'weighted'),
  ('Incline Barbell Bench Press',      'chest',      'barbell',    'weighted'),
  ('Decline Barbell Bench Press',      'chest',      'barbell',    'weighted'),
  ('Floor Press',                      'chest',      'barbell',    'weighted'),
  ('Dumbbell Bench Press',             'chest',      'dumbbell',   'weighted'),
  ('Incline Dumbbell Press',           'chest',      'dumbbell',   'weighted'),
  ('Decline Dumbbell Press',           'chest',      'dumbbell',   'weighted'),
  ('Dumbbell Fly',                     'chest',      'dumbbell',   'weighted'),
  ('Incline Dumbbell Fly',             'chest',      'dumbbell',   'weighted'),
  ('Dumbbell Pullover',                'chest',      'dumbbell',   'weighted'),
  ('Machine Chest Press',              'chest',      'machine',    'weighted'),
  ('Incline Machine Press',            'chest',      'machine',    'weighted'),
  ('Smith Machine Bench Press',        'chest',      'machine',    'weighted'),
  ('Smith Machine Incline Press',      'chest',      'machine',    'weighted'),
  ('Pec Deck / Chest Fly',             'chest',      'machine',    'weighted'),
  ('Cable Crossover',                  'chest',      'cable',      'weighted'),
  ('Low-to-High Cable Fly',            'chest',      'cable',      'weighted'),
  ('High-to-Low Cable Fly',            'chest',      'cable',      'weighted'),
  ('Cable Chest Press',                'chest',      'cable',      'weighted'),
  ('Push-Up',                          'chest',      'bodyweight', 'bodyweight'),
  ('Incline Push-Up',                  'chest',      'bodyweight', 'bodyweight'),
  ('Decline Push-Up',                  'chest',      'bodyweight', 'bodyweight'),
  ('Chest Dip',                        'chest',      'bodyweight', 'bodyweight'),
  ('Assisted Chest Dip',               'chest',      'machine',    'assisted'),

  -- Back
  ('Pull-Up',                          'back',       'bodyweight', 'bodyweight'),
  ('Chin-Up',                          'back',       'bodyweight', 'bodyweight'),
  ('Neutral-Grip Pull-Up',             'back',       'bodyweight', 'bodyweight'),
  ('Assisted Pull-Up',                 'back',       'machine',    'assisted'),
  ('Assisted Chin-Up',                 'back',       'machine',    'assisted'),
  ('Band-Assisted Pull-Up',            'back',       'bands',      'assisted'),
  ('Inverted Row',                     'back',       'bodyweight', 'bodyweight'),
  ('Lat Pulldown',                     'back',       'cable',      'weighted'),
  ('Wide-Grip Lat Pulldown',           'back',       'cable',      'weighted'),
  ('Close-Grip Lat Pulldown',          'back',       'cable',      'weighted'),
  ('Single-Arm Lat Pulldown',          'back',       'cable',      'weighted'),
  ('Machine Lat Pulldown',             'back',       'machine',    'weighted'),
  ('Straight-Arm Pulldown',            'back',       'cable',      'weighted'),
  ('Seated Cable Row',                 'back',       'cable',      'weighted'),
  ('Single-Arm Cable Row',             'back',       'cable',      'weighted'),
  ('Machine Row',                      'back',       'machine',    'weighted'),
  ('Chest-Supported Row',              'back',       'machine',    'weighted'),
  ('Chest-Supported Dumbbell Row',     'back',       'dumbbell',   'weighted'),
  ('Bent-Over Barbell Row',            'back',       'barbell',    'weighted'),
  ('Pendlay Row',                      'back',       'barbell',    'weighted'),
  ('T-Bar Row',                        'back',       'barbell',    'weighted'),
  ('Seal Row',                         'back',       'barbell',    'weighted'),
  ('Meadows Row',                      'back',       'barbell',    'weighted'),
  ('Single-Arm Dumbbell Row',          'back',       'dumbbell',   'weighted'),
  ('Kettlebell Row',                   'back',       'kettlebell', 'weighted'),
  ('Face Pull',                        'back',       'cable',      'weighted'),
  ('Barbell Shrug',                    'back',       'barbell',    'weighted'),
  ('Dumbbell Shrug',                   'back',       'dumbbell',   'weighted'),
  ('Rack Pull',                        'back',       'barbell',    'weighted'),
  ('Back Extension',                   'back',       'bodyweight', 'bodyweight'),
  ('Band Pull-Apart',                  'back',       'bands',      'weighted'),

  -- Shoulders
  ('Overhead Press',                   'shoulders',  'barbell',    'weighted'),
  ('Seated Barbell Overhead Press',    'shoulders',  'barbell',    'weighted'),
  ('Push Press',                       'shoulders',  'barbell',    'weighted'),
  ('Landmine Press',                   'shoulders',  'barbell',    'weighted'),
  ('Seated Dumbbell Shoulder Press',   'shoulders',  'dumbbell',   'weighted'),
  ('Standing Dumbbell Shoulder Press', 'shoulders',  'dumbbell',   'weighted'),
  ('Arnold Press',                     'shoulders',  'dumbbell',   'weighted'),
  ('Machine Shoulder Press',           'shoulders',  'machine',    'weighted'),
  ('Smith Machine Shoulder Press',     'shoulders',  'machine',    'weighted'),
  ('Kettlebell Overhead Press',        'shoulders',  'kettlebell', 'weighted'),
  ('Lateral Raise',                    'shoulders',  'dumbbell',   'weighted'),
  ('Cable Lateral Raise',              'shoulders',  'cable',      'weighted'),
  ('Machine Lateral Raise',            'shoulders',  'machine',    'weighted'),
  ('Front Raise',                      'shoulders',  'dumbbell',   'weighted'),
  ('Cable Front Raise',                'shoulders',  'cable',      'weighted'),
  ('Plate Front Raise',                'shoulders',  'barbell',    'weighted'),
  ('Rear Delt Fly',                    'shoulders',  'dumbbell',   'weighted'),
  ('Reverse Pec Deck',                 'shoulders',  'machine',    'weighted'),
  ('Cable Rear Delt Fly',              'shoulders',  'cable',      'weighted'),
  ('Upright Row',                      'shoulders',  'barbell',    'weighted'),
  ('Cable Upright Row',                'shoulders',  'cable',      'weighted'),
  ('Pike Push-Up',                     'shoulders',  'bodyweight', 'bodyweight'),
  ('Handstand Push-Up',                'shoulders',  'bodyweight', 'bodyweight'),

  -- Biceps and forearms
  ('Barbell Curl',                     'biceps',     'barbell',    'weighted'),
  ('EZ-Bar Curl',                      'biceps',     'barbell',    'weighted'),
  ('Dumbbell Curl',                    'biceps',     'dumbbell',   'weighted'),
  ('Hammer Curl',                      'biceps',     'dumbbell',   'weighted'),
  ('Incline Dumbbell Curl',            'biceps',     'dumbbell',   'weighted'),
  ('Concentration Curl',               'biceps',     'dumbbell',   'weighted'),
  ('Spider Curl',                      'biceps',     'dumbbell',   'weighted'),
  ('Zottman Curl',                     'biceps',     'dumbbell',   'weighted'),
  ('Cable Curl',                       'biceps',     'cable',      'weighted'),
  ('Rope Hammer Curl',                 'biceps',     'cable',      'weighted'),
  ('Bayesian Cable Curl',              'biceps',     'cable',      'weighted'),
  ('Preacher Curl',                    'biceps',     'machine',    'weighted'),
  ('EZ-Bar Preacher Curl',             'biceps',     'barbell',    'weighted'),
  ('Dumbbell Preacher Curl',           'biceps',     'dumbbell',   'weighted'),
  ('Machine Curl',                     'biceps',     'machine',    'weighted'),
  ('Band Curl',                        'biceps',     'bands',      'weighted'),
  ('Reverse Curl',                     'biceps',     'barbell',    'weighted'),
  ('Wrist Curl',                       'biceps',     'barbell',    'weighted'),
  ('Reverse Wrist Curl',               'biceps',     'barbell',    'weighted'),

  -- Triceps
  ('Triceps Pushdown',                 'triceps',    'cable',      'weighted'),
  ('Rope Pushdown',                    'triceps',    'cable',      'weighted'),
  ('Single-Arm Cable Pushdown',        'triceps',    'cable',      'weighted'),
  ('Overhead Triceps Extension',       'triceps',    'dumbbell',   'weighted'),
  ('Cable Overhead Triceps Extension', 'triceps',    'cable',      'weighted'),
  ('Close-Grip Bench Press',           'triceps',    'barbell',    'weighted'),
  ('JM Press',                         'triceps',    'barbell',    'weighted'),
  ('Skull Crusher',                    'triceps',    'barbell',    'weighted'),
  ('Dumbbell Skull Crusher',           'triceps',    'dumbbell',   'weighted'),
  ('Triceps Kickback',                 'triceps',    'dumbbell',   'weighted'),
  ('Cable Kickback',                   'triceps',    'cable',      'weighted'),
  ('Machine Triceps Extension',        'triceps',    'machine',    'weighted'),
  ('Machine Dip',                      'triceps',    'machine',    'weighted'),
  ('Dip',                              'triceps',    'bodyweight', 'bodyweight'),
  ('Assisted Dip',                     'triceps',    'machine',    'assisted'),
  ('Band-Assisted Dip',                'triceps',    'bands',      'assisted'),
  ('Bench Dip',                        'triceps',    'bodyweight', 'bodyweight'),
  ('Diamond Push-Up',                  'triceps',    'bodyweight', 'bodyweight'),

  -- Quads
  ('Barbell Back Squat',               'quads',      'barbell',    'weighted'),
  ('Front Squat',                      'quads',      'barbell',    'weighted'),
  ('Box Squat',                        'quads',      'barbell',    'weighted'),
  ('Safety Bar Squat',                 'quads',      'barbell',    'weighted'),
  ('Zercher Squat',                    'quads',      'barbell',    'weighted'),
  ('Thruster',                         'quads',      'barbell',    'weighted'),
  ('Goblet Squat',                     'quads',      'dumbbell',   'weighted'),
  ('Kettlebell Goblet Squat',          'quads',      'kettlebell', 'weighted'),
  ('Smith Machine Squat',              'quads',      'machine',    'weighted'),
  ('Leg Press',                        'quads',      'machine',    'weighted'),
  ('Single-Leg Leg Press',             'quads',      'machine',    'weighted'),
  ('Hack Squat',                       'quads',      'machine',    'weighted'),
  ('Pendulum Squat',                   'quads',      'machine',    'weighted'),
  ('Belt Squat',                       'quads',      'machine',    'weighted'),
  ('Leg Extension',                    'quads',      'machine',    'weighted'),
  ('Single-Leg Extension',             'quads',      'machine',    'weighted'),
  ('Sled Push',                        'quads',      'machine',    'weighted'),
  ('Walking Lunge',                    'quads',      'dumbbell',   'weighted'),
  ('Reverse Lunge',                    'quads',      'dumbbell',   'weighted'),
  ('Barbell Lunge',                    'quads',      'barbell',    'weighted'),
  ('Bulgarian Split Squat',            'quads',      'dumbbell',   'weighted'),
  ('Split Squat',                      'quads',      'dumbbell',   'weighted'),
  ('Step-Up',                          'quads',      'dumbbell',   'weighted'),
  ('Bodyweight Squat',                 'quads',      'bodyweight', 'bodyweight'),
  ('Jump Squat',                       'quads',      'bodyweight', 'bodyweight'),
  ('Pistol Squat',                     'quads',      'bodyweight', 'bodyweight'),
  ('Sissy Squat',                      'quads',      'bodyweight', 'bodyweight'),
  ('Box Jump',                         'quads',      'bodyweight', 'bodyweight'),
  ('Burpee',                           'quads',      'bodyweight', 'bodyweight'),

  -- Hamstrings
  ('Conventional Deadlift',            'hamstrings', 'barbell',    'weighted'),
  ('Trap Bar Deadlift',                'hamstrings', 'barbell',    'weighted'),
  ('Romanian Deadlift',                'hamstrings', 'barbell',    'weighted'),
  ('Stiff-Leg Deadlift',               'hamstrings', 'barbell',    'weighted'),
  ('Dumbbell Romanian Deadlift',       'hamstrings', 'dumbbell',   'weighted'),
  ('Single-Leg Romanian Deadlift',     'hamstrings', 'dumbbell',   'weighted'),
  ('Kettlebell Romanian Deadlift',     'hamstrings', 'kettlebell', 'weighted'),
  ('Good Morning',                     'hamstrings', 'barbell',    'weighted'),
  ('Power Clean',                      'hamstrings', 'barbell',    'weighted'),
  ('Hang Clean',                       'hamstrings', 'barbell',    'weighted'),
  ('Lying Leg Curl',                   'hamstrings', 'machine',    'weighted'),
  ('Seated Leg Curl',                  'hamstrings', 'machine',    'weighted'),
  ('Standing Leg Curl',                'hamstrings', 'machine',    'weighted'),
  ('Nordic Hamstring Curl',            'hamstrings', 'bodyweight', 'bodyweight'),
  ('Glute-Ham Raise',                  'hamstrings', 'bodyweight', 'bodyweight'),

  -- Glutes
  ('Hip Thrust',                       'glutes',     'barbell',    'weighted'),
  ('Machine Hip Thrust',               'glutes',     'machine',    'weighted'),
  ('Barbell Glute Bridge',             'glutes',     'barbell',    'weighted'),
  ('Glute Bridge',                     'glutes',     'bodyweight', 'bodyweight'),
  ('Single-Leg Glute Bridge',          'glutes',     'bodyweight', 'bodyweight'),
  ('Sumo Deadlift',                    'glutes',     'barbell',    'weighted'),
  ('Kettlebell Swing',                 'glutes',     'kettlebell', 'weighted'),
  ('Cable Pull-Through',               'glutes',     'cable',      'weighted'),
  ('Glute Kickback',                   'glutes',     'machine',    'weighted'),
  ('Cable Glute Kickback',             'glutes',     'cable',      'weighted'),
  ('Hip Abduction Machine',            'glutes',     'machine',    'weighted'),
  ('Hip Adduction Machine',            'glutes',     'machine',    'weighted'),
  ('Curtsy Lunge',                     'glutes',     'dumbbell',   'weighted'),
  ('Reverse Hyperextension',           'glutes',     'machine',    'weighted'),
  ('Frog Pump',                        'glutes',     'bodyweight', 'bodyweight'),

  -- Calves
  ('Standing Calf Raise',              'calves',     'machine',    'weighted'),
  ('Seated Calf Raise',                'calves',     'machine',    'weighted'),
  ('Leg Press Calf Raise',             'calves',     'machine',    'weighted'),
  ('Smith Machine Calf Raise',         'calves',     'machine',    'weighted'),
  ('Donkey Calf Raise',                'calves',     'machine',    'weighted'),
  ('Dumbbell Calf Raise',              'calves',     'dumbbell',   'weighted'),
  ('Single-Leg Calf Raise',            'calves',     'bodyweight', 'bodyweight'),
  ('Tibialis Raise',                   'calves',     'bodyweight', 'bodyweight'),

  -- Core
  ('Plank',                            'core',       'bodyweight', 'bodyweight'),
  ('Side Plank',                       'core',       'bodyweight', 'bodyweight'),
  ('Crunch',                           'core',       'bodyweight', 'bodyweight'),
  ('Sit-Up',                           'core',       'bodyweight', 'bodyweight'),
  ('Decline Sit-Up',                   'core',       'bodyweight', 'bodyweight'),
  ('Bicycle Crunch',                   'core',       'bodyweight', 'bodyweight'),
  ('Russian Twist',                    'core',       'bodyweight', 'bodyweight'),
  ('Leg Raise',                        'core',       'bodyweight', 'bodyweight'),
  ('Hanging Leg Raise',                'core',       'bodyweight', 'bodyweight'),
  ('Hanging Knee Raise',               'core',       'bodyweight', 'bodyweight'),
  ('Captain''s Chair Leg Raise',       'core',       'bodyweight', 'bodyweight'),
  ('Toes-to-Bar',                      'core',       'bodyweight', 'bodyweight'),
  ('V-Up',                             'core',       'bodyweight', 'bodyweight'),
  ('Dead Bug',                         'core',       'bodyweight', 'bodyweight'),
  ('Mountain Climber',                 'core',       'bodyweight', 'bodyweight'),
  ('Dragon Flag',                      'core',       'bodyweight', 'bodyweight'),
  ('Ab Wheel Rollout',                 'core',       'bodyweight', 'bodyweight'),
  ('Cable Crunch',                     'core',       'cable',      'weighted'),
  ('Machine Crunch',                   'core',       'machine',    'weighted'),
  ('Pallof Press',                     'core',       'cable',      'weighted'),
  ('Cable Woodchopper',                'core',       'cable',      'weighted'),
  ('Landmine Rotation',                'core',       'barbell',    'weighted'),
  ('Farmer''s Carry',                  'core',       'dumbbell',   'weighted'),
  ('Suitcase Carry',                   'core',       'dumbbell',   'weighted'),
  ('Turkish Get-Up',                   'core',       'kettlebell', 'weighted')
) as v(name, muscle_group, equipment, load_type)
on conflict do nothing;

-- Existing library rows predate load types and some were given equipment by a
-- name-matching backfill. Correct them to the catalog above. Library rows only
-- (user_id is null); nobody's custom exercises are touched.
update exercises e
set load_type = v.load_type::exercise_load_type,
    equipment = v.equipment::equipment_kind
from (values
  ('Push-Up',             'bodyweight', 'bodyweight'),
  ('Pull-Up',             'bodyweight', 'bodyweight'),
  ('Dip',                 'bodyweight', 'bodyweight'),
  ('Plank',               'bodyweight', 'bodyweight'),
  ('Hanging Leg Raise',   'bodyweight', 'bodyweight'),
  ('Ab Wheel Rollout',    'bodyweight', 'bodyweight'),
  ('Rear Delt Fly',       'weighted',   'dumbbell'),
  ('Lateral Raise',       'weighted',   'dumbbell'),
  ('Walking Lunge',       'weighted',   'dumbbell'),
  ('Hammer Curl',         'weighted',   'dumbbell'),
  ('Overhead Triceps Extension', 'weighted', 'dumbbell'),
  ('Standing Calf Raise', 'weighted',   'machine'),
  ('Seated Calf Raise',   'weighted',   'machine')
) as v(name, load_type, equipment)
where e.user_id is null and lower(e.name) = lower(v.name);

-- ---------------------------------------------------------------------------
-- 4. More activities. ADD VALUE cannot be used in the same transaction it is
--    added in, so nothing below this point refers to the new values.
-- ---------------------------------------------------------------------------
alter type activity_kind add value if not exists 'pickleball';
alter type activity_kind add value if not exists 'volleyball';
alter type activity_kind add value if not exists 'baseball';
alter type activity_kind add value if not exists 'softball';
alter type activity_kind add value if not exists 'football';
alter type activity_kind add value if not exists 'hockey';
alter type activity_kind add value if not exists 'golf';
alter type activity_kind add value if not exists 'badminton';
alter type activity_kind add value if not exists 'table_tennis';
alter type activity_kind add value if not exists 'racquetball';
alter type activity_kind add value if not exists 'squash';
alter type activity_kind add value if not exists 'lacrosse';
alter type activity_kind add value if not exists 'rugby';
alter type activity_kind add value if not exists 'ultimate_frisbee';
alter type activity_kind add value if not exists 'wrestling';
alter type activity_kind add value if not exists 'martial_arts';
alter type activity_kind add value if not exists 'skiing';
alter type activity_kind add value if not exists 'snowboarding';
alter type activity_kind add value if not exists 'skating';
alter type activity_kind add value if not exists 'skateboarding';
alter type activity_kind add value if not exists 'surfing';
alter type activity_kind add value if not exists 'kayaking';
alter type activity_kind add value if not exists 'paddleboarding';
alter type activity_kind add value if not exists 'spin';
alter type activity_kind add value if not exists 'hiit';
alter type activity_kind add value if not exists 'crossfit';
alter type activity_kind add value if not exists 'pilates';
alter type activity_kind add value if not exists 'dance';
alter type activity_kind add value if not exists 'stretching';

-- ---------------------------------------------------------------------------
-- 5. Consent at sign-up.
--
-- The app sends terms_version and age_confirmed in the sign-up request's user
-- metadata; the trigger that creates the profile copies them onto it. Only a
-- confirmation is stored — never a date of birth.
-- ---------------------------------------------------------------------------
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
    terms_accepted_at, terms_version, age_confirmed_at
  )
  values (
    new.id, candidate, null, false,
    case when accepted_version is not null then now() end,
    accepted_version,
    case when age_ok then now() end
  );
  return new;
end $$;
