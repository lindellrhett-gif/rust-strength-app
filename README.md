# Rust Strength

**A workout tracker for iPhone that tells you what weight to put on the bar for your next set.**

You log a set with its weight, reps, and how hard it felt. The app estimates
your current strength from your recent sets and suggests the load for the next
one. Over time it learns your gym's machines too, so a PR on one cable stack
carries over to a differently labeled one.

**Status:** [live on the App Store](https://apps.apple.com/us/app/rust-strength/id6811736131) since October 2, 2026, after beta
testing on TestFlight · **Role:** solo developer · **Built:** September 2026

<p align="center">
  <img src="media/screenshots/suggestion.png" width="200" alt="Add set screen with a suggested next weight of 230 lb for 4 to 6 reps, the estimated one-rep max, last session's top set, and a rest timer" />
  <img src="media/screenshots/today.png" width="200" alt="Today screen with a 5-day streak, pounds lifted, sets, and total training time" />
  <img src="media/screenshots/workout.png" width="200" alt="Active workout from a preset, with elapsed time, planned sets, and a rest timer" />
  <img src="media/screenshots/friends.png" width="200" alt="Friends feed showing finished sessions with personal records, volume, sets and reps" />
</p>

---

## For employers and reviewers

Hi, I'm Rhett Lindell, a Computer Science student (Cybersecurity minor) at the
University of North Dakota, graduating May 2029. I'm looking for internships in
AI development, software engineering, or cybersecurity.

[Portfolio](https://lindellrhett-gif.github.io/) ·
[Résumé](https://lindellrhett-gif.github.io/resume.html) ·
[LinkedIn](https://www.linkedin.com/in/rhett-lindell) ·
[lindellrhett@gmail.com](mailto:lindellrhett@gmail.com)

### At a glance

| | |
|---|---|
| **Scope** | A full iOS app, from the database to the App Store submission, built solo |
| **Timeline** | First commit September 7, 2026; submitted to the App Store September 27, 2026; released October 2, 2026 |
| **App code** | About 37,500 lines of TypeScript across the screens, components, domain logic and data layer, plus about 600 lines of Swift for the Lock Screen Live Activities |
| **Database** | About 7,000 lines of SQL in 27 migrations, including tables, Row Level Security policies, PostGIS route handling, full-text food search and server functions |
| **Tests** | 951 Jest tests in 63 suites, 16 database test suites that run every migration in PGlite, plus strict TypeScript and ESLint |
| **Tools** | Git, EAS Build, TestFlight, and Claude Code for AI-assisted development |
| **Users** | Beta tested on TestFlight, now [on the App Store](https://apps.apple.com/us/app/rust-strength/id6811736131) |

### A five-minute code tour

If you only open a few files, open these:

| What it shows | Where to look |
|---|---|
| **Algorithm design:** the next-set weight recommender (estimated one-rep max, smoothing, safety limits) | [`src/domain/recommender.ts`](src/domain/recommender.ts) · [tests](__tests__/recommender.test.ts) |
| **Working from real data:** learning the conversion between two gym machines from paired sessions | [`src/domain/machines.ts`](src/domain/machines.ts) · [tests](__tests__/machines.test.ts) |
| **Database security:** friendships, and profiles only visible to friends, enforced by Row Level Security | [`supabase/migrations/0002_milestone2.sql`](supabase/migrations/0002_milestone2.sql) |
| **A privacy fix and a performance fix** found in my own pre-launch review | [`supabase/migrations/0009_feed_hardening.sql`](supabase/migrations/0009_feed_hardening.sql) |
| **Advanced SQL:** streaks and consistency calculated on the server with a gaps-and-islands query | [`supabase/migrations/0014_streaks_friend_time.sql`](supabase/migrations/0014_streaks_friend_time.sql) |
| **Offline-first sync:** writes queued in order and replayed when the connection returns | [`src/data/mutationDefaults.ts`](src/data/mutationDefaults.ts) · [`src/data/workouts.ts`](src/data/workouts.ts) |
| **Debugging an auth race:** holding data requests until an expired session refreshes | [`src/lib/sessionGuard.ts`](src/lib/sessionGuard.ts) · [`src/lib/supabase.ts`](src/lib/supabase.ts) |
| **One source for legal text:** the Privacy Policy and Terms generated for the app and the website from the same code | [`scripts/build-legal.js`](scripts/build-legal.js) |
| **Guardrails as code:** a calorie goal form that offers no weight-loss goal to anyone under 18, tested case by case | [`src/domain/nutrition/goalForm.ts`](src/domain/nutrition/goalForm.ts) · [tests](__tests__/nutritionGoals.test.ts) |

### Problems I solved

- **"Workout not found" after an hour away.** While the app sat in the
  background, the sign-in token expired, so requests went out with only the
  public key. Row Level Security then correctly returned nothing. A fetch guard
  now holds those requests until the session refreshes, and retries them with
  backoff.
- **A friend's workout time showing 23 hours instead of 2.** A SQL query joined
  sets before adding up session lengths, so each workout was counted once per
  set. I split the totals into separate lateral joins.
- **Users unable to confirm their email.** Some email security filters open
  links to scan them, which can use up a single-use confirmation link before
  the user taps it. Sign-up and password reset now use 6-digit codes instead.
- **Getting stronger looked like a machine difference.** The first
  machine-ratio model paired a new personal record with an older session on the
  other machine. Pairing each session only with its nearest counterpart inside a
  time window fixed it, and there are tests for it.

### Run the tests

The core logic is pure TypeScript, so the tests need no database or phone:

```bash
npm install
npm test
```

---

## Features

**Training**
- **Next-set weight suggestions** from your recent history, aimed at the rep
  range you set for that exercise.
- **Machine-aware recommendations.** The app keeps each machine's history
  separate and learns the conversion between two machines from sessions done
  close together.
- **Four exercise types:** weighted, bodyweight (with added weight), assisted
  (like an assisted pull-up machine), and **timed holds** with a built-in
  countdown timer and suggested hold times.
- **Rest timer** that starts when you save a set, with a notification when rest
  is over, even with the phone locked. From 1.1 it also counts down on the
  Lock Screen and in the Dynamic Island with your next set.
- **Presets** with a rep range per exercise, and a **workout generator** that
  builds a session from your equipment and what you have not trained this week.
- **Review screen** after each workout to fix the name, the length, or any
  mistyped set.
- **200+ built-in exercises**, plus your own.
- **Activities** such as runs and classes, timed live or entered to the second.

**Progress**
- Streaks, 30-day consistency, volume, time trained, and personal records.
  Planned rest days keep a streak alive without adding to it.
- A progress chart per exercise, and a body chart of what you trained this week.
- Levels, trophies, and badges. From 1.1, trophies for running, steps, friends
  and reactions, and two of your choice shown by your name.

**Friends**
- Friend requests by username, and a **feed** of friends' finished sessions
  with reactions.
- A **leaderboard** ranking you and your friends by streak, weight lifted,
  workout time, consistency, and activity time, over a chosen period (from
  1.1 also distance run and, for people who share them, daily steps).
- Blocking, reporting, and a switch to stop sharing your workouts.
- **Share cards** (from 1.1): after a workout or a run, an image with the
  numbers, records, muscles worked or the route's shape, ready for Instagram,
  Messages or Photos. It's drawn on the phone and nothing is uploaded; a
  run's route is trimmed at the start and end as on friends' maps.

**Rust Strength Pro** (built, not on sale)
- Optional monthly or yearly subscription, or a one-time Lifetime purchase,
  through RevenueCat (its paywall and Customer Center) for features still to
  come (nutrition, an AI coach). Everything above stays free. Switched off
  until a paid feature exists; see [store/SUBSCRIPTIONS.md](store/SUBSCRIPTIONS.md).

**Reliability and privacy**
- **Works offline.** Sets logged with no signal are queued and sync when the
  connection returns. Nothing is lost if the app is closed mid-workout.
- **Download all your data** or **delete your account** from inside the app.

---

## Running (version 1.1, in development)

GPS run tracking, built into the same app: runs are activities, so they
appear in the Calendar, the friends feed, Stats and the streak.

- **Recording:** a full-screen recorder with a countdown, the time,
  distance, current and average pace, and the route drawn live on Apple
  Maps. It keeps recording with the screen locked, survives the app being
  closed mid-run (reopening offers Resume, Finish or Discard), and counts
  steps and cadence from the phone's motion sensors.
- **Lock Screen and Dynamic Island:** the time, distance and pace stay in
  view with the phone locked (an iOS Live Activity, drawn by a SwiftUI widget
  extension). iOS ticks the clock itself, so the app only sends an update when
  something else changes, and if the app is closed mid-run the activity says
  it has stopped updating instead of counting on.
- **Auto-pause** goes by the phone's own speed reading, so the clock holds
  the moment you stop at a light and starts again as you move off. Losing
  signal in a tunnel doesn't pause it.
- **Spoken updates** every mile or kilometre, which lower your music while
  they talk.
- **Run summary:** map, splits, best efforts inside the run, pace and
  elevation charts, effort and notes. Runs can be edited, deleted, and
  trimmed at either end (everything is worked out again from the part
  kept).
- **History:** weekly and monthly distance, a weekly goal, records for the
  mile, 5K, 10K, half and marathon, and a calendar of runs.
- **Saved routes:** save a run's route, run it again with the route drawn
  on the map, and compare every attempt.
- **Sharing:** friends see distance, time and pace by default. The map is
  shared only if you turn it on for a run, and the server always removes
  the first and last 200 m and anything inside your privacy zones before
  anyone else sees it.
- **Manual entry** for treadmill runs and runs without the phone.

| Where to look | What it shows |
|---|---|
| [`src/domain/running/filter.ts`](src/domain/running/filter.ts), [`stops.ts`](src/domain/running/stops.ts) | Cleaning GPS: accuracy, spikes, jitter, and auto-pause from the phone's speed reading |
| [`__tests__/runningAutoPause.test.ts`](__tests__/runningAutoPause.test.ts) | Simulated runs replayed second by second, as the screen sees them |
| [`supabase/migrations/0021_run_sharing.sql`](supabase/migrations/0021_run_sharing.sql) | Server-side trimming of shared routes with privacy zones (PostGIS) |
| [`supabase/tests/sharing.test.mjs`](supabase/tests/sharing.test.mjs) | Proving a shared outline never comes within a privacy zone |
| [`targets/widget/`](targets/widget), [`modules/live-activities/`](modules/live-activities) | The Live Activities in Swift (a run, and the rest timer): the widget that draws them and the small native module that starts and updates them |

**Permissions.** Location "While Using the App" when a run starts (never
"Always"), with background location updates while recording; Motion &
Fitness for steps. The Info.plist strings live in `app.json` (the
`expo-location` and `expo-sensors` plugins), `UIBackgroundModes` is
`location` and `audio`, and `NSSupportsLiveActivities` turns on the Lock
Screen view, which needs no permission (people can turn it off in Settings).

**Battery.** GPS at its most accurate setting is the main cost, and it runs
only between Start and Finish. I haven't measured the drain per hour on a
real run yet. Every fix is kept (about one a second), because a distance
filter saves little power while the GPS is on and would hide stops. With the
phone locked the recording screen does no work at all; with it on, the track
is cleaned once per new fix and redrawn every 2 to 5 seconds on runs over an
hour.

---

## Food diary (version 1.2, in development)

A food diary in the same app, and the first paid feature (Rust Strength Pro).
It's built like the set logger: an entry is saved on the phone first and
reaches the server when there's a connection.

- **Finding food:** about 13,500 everyday foods from USDA FoodData Central,
  loaded by a script and searched in Postgres with a word-prefix full-text
  search that ranks plain foods first ("banana" finds "Bananas, raw" before a
  banana yogurt); packaged foods by barcode or name from Open Food Facts,
  looked up from the phone; recent and frequent foods; quick add.
- **Logging:** amounts in a food's own portions ("1 medium"), grams, ounces,
  ml or fl oz. Each entry keeps its own copy of the numbers, so changing a
  food later doesn't rewrite past days. Copy a meal or a day, save meals,
  create foods from a label, and build recipes or import one from a link
  (the page's schema.org recipe data, read on the phone).
- **Barcode scanner:** `expo-camera`, loaded lazily so an older build says to
  update instead of failing. Your own foods are checked first, offline too.
- **Goals:** a Mifflin-St Jeor calculator with guardrails (no weight-loss goal
  under 18, using the lowest age a birth year allows; a warning under the
  calorie floor; nothing under 800 kcal), macros by percent or grams,
  nutrient targets with the FDA Daily Values, and a split by meal. Goals are
  dated, so past days keep the goal they had.
- **Tracking:** water, weigh-ins with a smoothed trend and a weekly rate (a
  least-squares slope over four weeks), and reports for 7 days, 30 days and
  12 weeks.
- **Private:** every diary table is owner-only under Row Level Security, and
  nothing in it reaches friends.

| Where to look | What it shows |
|---|---|
| [`supabase/migrations/0027_nutrition.sql`](supabase/migrations/0027_nutrition.sql) | Eleven tables with RLS, the catalog search and loader, and saving a meal or recipe with its items in one transaction |
| [`src/domain/nutrition/`](src/domain/nutrition) | The pure logic: amounts and portions, totals, the goal calculator and form, reports, Open Food Facts and recipe parsing |
| [`scripts/usda.js`](scripts/usda.js) | Turning USDA FoodData Central downloads into catalog rows |
| [`supabase/tests/nutrition.test.mjs`](supabase/tests/nutrition.test.mjs) | RLS checked as each user, plus export and account deletion |

---

## Tech stack

| Layer | Tools |
|---|---|
| App | TypeScript, React Native 0.86, React 19, Expo SDK 57, Expo Router |
| Data and sync | TanStack Query v5 with a persisted offline cache and queued writes, supabase-js |
| Backend | Supabase: PostgreSQL with PostGIS, Auth, Row Level Security, SQL functions |
| Native iOS | Swift and ActivityKit for the Live Activities (a widget extension through @bacons/apple-targets and a local Expo module), expo-location and expo-task-manager for GPS with the screen locked, expo-camera for barcodes |
| Subscriptions | RevenueCat (react-native-purchases), with a Supabase Edge Function webhook mirroring Pro status |
| Food data | USDA FoodData Central (public domain) in the database; Open Food Facts (ODbL) from the phone |
| Forms and validation | React Hook Form, Zod |
| Graphics | react-native-svg for charts, the body chart and share cards; react-native-maps (Apple Maps) for routes |
| Testing and quality | Jest (63 suites, 951 tests), database tests on PGlite (16 suites), ESLint, strict TypeScript |
| Release | EAS Build and EAS Submit, TestFlight, App Store Connect |
| Website | Static HTML generated by a Node script and hosted on GitHub Pages |

---

## How it works

### The recommender

The core logic lives in [`src/domain/recommender.ts`](src/domain/recommender.ts).
It is pure TypeScript with no React or network code, so it is fully unit
tested.

1. **Estimate strength from each set.** How hard the set felt (RPE) becomes
   reps left in reserve. Weight and reps-to-failure go into the Epley formula
   to estimate a one-rep max (e1RM). Reps are capped at 12 in the formula,
   because the estimate stops being reliable for long sets.
2. **Smooth the estimate.** An exponential moving average over the last six
   working sets, so one great or terrible day does not swing the next
   suggestion.
3. **Pick the next load.** The formula is run backwards for the target rep
   range, nudged by the last set's RPE, limited to a 15% change from last
   time, and rounded to what that machine or bar can actually load.

Timed holds use a separate, simpler model that works in 5-second steps.

### Learning machines

Two cable stacks in the same gym can be labeled completely differently, so
50 lb on one is 100 lb on another. [`src/domain/machines.ts`](src/domain/machines.ts)
learns that ratio automatically:

- It pairs sessions of the same exercise on the two machines that were done
  within 14 days of each other. Each session is matched only to its closest
  counterpart, so getting stronger over time is not mistaken for a difference
  between machines.
- It takes the **median** ratio of the 12 most recent pairs, which ignores one
  odd session.
- Before suggesting a weight, it converts history from the other machine using
  that ratio. A new PR on machine 1 moves the suggestion on machine 2.

### Offline-first sync

Gym basements have bad signal, so the app is built to work without it.

- TanStack Query's cache is saved to device storage, so the app opens with your
  data straight away.
- Writes are queued in order (start workout, then add a set, then finish) and
  replayed when the connection returns.
- A custom fetch guard stops the app sending a data request while its sign-in
  session is still refreshing. Without it, returning after an hour away could
  show "workout not found". Requests retry with backoff instead.

### Security and privacy

Every table has **Row Level Security** turned on, so the database itself
refuses requests for anyone else's data, whatever the app sends.

- Your own rows are only reachable by you (`user_id = auth.uid()`).
- Anything that reads another person's data runs through a SQL function that
  checks, inside the database:
  - you are accepted friends,
  - they have sharing turned on,
  - neither of you has blocked the other.
- Friends only ever get **summaries**: a finished session's totals, leaderboard
  figures, and records. The set-by-set log of a workout never leaves the server.
- Reaction rows are readable only by the person who left them, so the database
  enforces the Privacy Policy's promise that you see counts, not names.
- Badges have no write policy at all. Only an admin can award one, so nobody can
  grant themselves "Influencer" through the API.
- Sign-up and password reset use one-time email codes.
- The only key in the app is Supabase's public anon key. There is no service
  role key anywhere in the app.

### Legal and store readiness

The Privacy Policy and Terms are written in [`src/legal/`](src/legal). One
script ([`scripts/build-legal.js`](scripts/build-legal.js)) generates both the
in-app screens and the public website from that source, so the two can never
say different things. Another ([`scripts/build-notices.js`](scripts/build-notices.js))
builds the in-app Acknowledgements from the iOS bundle's source map, so it
lists exactly the open-source packages that ship, with their licences. The app also includes account deletion inside the app,
a data export, age confirmation, and a user-content moderation workflow for
reported users.

---

## Project layout

```
app/                 Screens, routed by file with Expo Router
  (auth)/            Sign in, sign up, email code, password reset
  (tabs)/            Today, Calendar, Stats, Friends, Profile
  workout/           Active workout, review, summary
  set/new.tsx        Add-set screen with the live suggestion
  run/               Recorder, run summary, editing, history hub, routes
  nutrition/         Food diary, add food, scanner, foods, recipes, goals,
                     weight, reports
src/
  domain/            Pure, unit-tested logic: recommender, machines, streaks,
                     leaderboard, generator, XP, and more
    running/         GPS cleaning, auto-pause, splits, best efforts, charts
    nutrition/       Amounts, totals, goals and guardrails, reports, food data
  data/              TanStack Query hooks over Supabase
  components/        Shared UI, the hold timer, charts
  lib/               Supabase client, session guard, query client
  legal/             Privacy Policy and Terms source
supabase/
  migrations/        Schema, RLS policies and SQL functions (0001 to 0027)
  tests/             Migrations run in PGlite, with RLS checked as each user
  email-templates/   Code-based sign-up and reset emails
modules/live-activities/  Local native module (Swift) for the Live Activities
targets/widget/      Widget extension (SwiftUI) that draws it, added at prebuild
__tests__/           Jest specs
scripts/             Legal site, acknowledgements, food catalog, icon and
                     screenshot generators
```

## Running it locally

See **[SETUP.md](SETUP.md)**.

---

## My role

I built Rust Strength on my own:

- **Product and design:** chose the features, designed the screens, and worked
  through feedback from TestFlight testers.
- **Architecture:** chose the stack, designed the Postgres data model, and
  planned the offline sync.
- **Security:** wrote the Row Level Security policies and permission-checked
  SQL functions.
- **Algorithms:** built the weight recommender and the machine-conversion
  learning, both with unit tests.
- **Launch:** handled the builds, TestFlight, and App Store submission, plus the
  privacy policy, terms, and account deletion that App Review requires.

### How I used AI tools

I used Claude Code as a development tool, and it wrote a large share of the
implementation. That is how one person took a full app from first commit to
App Store submission in three weeks. The engineering decisions stayed with me:

- **I set the structure first.** I designed the data model, the Row Level
  Security rules, the offline sync approach, and how the recommender should
  behave, then had Claude Code build against that design one piece at a time.
- **I reviewed every change.** Nothing went in until I had read it and tested
  it. When something was wrong, I diagnosed the cause and directed the fix;
  [Problems I solved](#problems-i-solved) has examples.
- **Tests are the guardrail.** The core logic is pure TypeScript covered by 519
  Jest tests, under strict TypeScript and ESLint, so generated code has to pass
  the same checks as anything I write by hand.
- **I audited it before launch.** My own pre-launch review of the database found
  a privacy issue and a performance issue, both fixed in
  [`0009_feed_hardening.sql`](supabase/migrations/0009_feed_hardening.sql).

AI tools let me move faster; owning the design and verifying the output is what
makes the result reliable. I'm happy to walk through any part of the code.

**Links:** [Portfolio](https://lindellrhett-gif.github.io/) ·
[Support and legal pages](https://lindellrhett-gif.github.io/rust-strength/) ·
[GitHub](https://github.com/lindellrhett-gif)
