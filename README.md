# Gym App

Workout tracker with **autoregulated weight recommendations**. Log each set with
weight, reps, RPE and the machine you used; the app estimates your one-rep max
(e1RM) and tells you what to load for the next set to hit failure inside your
target rep range (default 6–8).

**Milestone 1** (this build): auth, workout logging loop, the recommender,
history, and stats (all-time totals, streaks, weekly whole-body coverage, PRs).
Deferred: AI-generated workouts, calendar/planning, friends/social, ML
personalization.

Stack: Expo (React Native) + TypeScript, Supabase (Postgres + Auth + RLS),
TanStack Query. Permanent dark theme.

---

## 1. Prerequisites

- **Node.js 20 LTS** — <https://nodejs.org>. Verify: `node -v`, `npm -v`.
- **Expo Go** app on your phone (iOS App Store / Google Play) for testing.
- A free **Supabase** account — <https://supabase.com>.

## 2. Install dependencies

```bash
cd C:\dev\gym-app
npm install
```

Dependencies are already installed and version-aligned to **Expo SDK 57**. Keep
the project on whatever SDK your Expo Go app uses — Expo Go only runs the newest
SDK, so if it auto-updates and the app refuses to open, realign with:

```bash
npm install expo@latest
```

then `npx expo install --fix`.

> **Do not move this project into a OneDrive-synced folder.** OneDrive syncs each
> of the ~1,500 files npm unpacks, which turns a 2-minute install into hours and
> can corrupt `node_modules` if interrupted.

## 3. Create the Supabase project

1. In the Supabase dashboard: **New project**. Pick a name and a database
   password (save it somewhere).
2. Wait for it to finish provisioning (~2 min).
3. **Project Settings → API**: copy the **Project URL** and the **anon public**
   key.

## 4. Apply the database schema

**Option A — dashboard (no CLI needed):**

1. Open **SQL Editor** in the dashboard.
2. Paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), run it.
3. Paste the contents of [`supabase/migrations/0002_milestone2.sql`](supabase/migrations/0002_milestone2.sql), run it.
4. Paste the contents of [`supabase/seed.sql`](supabase/seed.sql), run it.

Run them in that order. All three are safe to re-run, so if you are unsure
whether one applied, just run it again.

**Option B — Supabase CLI:**

```bash
npm i -g supabase
supabase link --project-ref <your-project-ref>
supabase db push
supabase db execute --file supabase/seed.sql
```

### Auth setting

For the fastest local testing, turn **off** email confirmation:
**Authentication → Providers → Email → "Confirm email" = off**. With it on, the
sign-up screen tells you to confirm via email before signing in.

## 5. Configure the app

```bash
cp .env.example .env
```

Edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
```

## 6. Run it

```bash
npx expo start -c
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). `-c` clears the
cache so the new `.env` is picked up.

## 7. Tests

The correctness-critical logic (e1RM, next-weight, rounding, streaks, coverage)
is pure and unit-tested:

```bash
npm test          # one run
npm run typecheck # tsc --noEmit
npm run lint
```

---

## Project layout

```
app/                      Expo Router screens
  (auth)/                 sign-in, sign-up
  (tabs)/                 Today, History, Stats, Profile
  workout/[id].tsx        active / past session
  set/new.tsx             add-set modal with the live recommendation
src/
  domain/                 PURE, tested logic
    recommender.ts        e1RM + next-set weight
    rounding.ts           round to a machine's weight step
    stats.ts              streaks, totals, weekly coverage
  data/                   TanStack Query hooks over Supabase
  lib/                    supabase client, query client, env, formatting
  components/             Screen, Button, Card, NumberStepper, RpeSelector, …
  providers/AuthProvider.tsx
  theme/                  single dark palette
supabase/
  migrations/0001_init.sql
  migrations/0002_milestone2.sql
  seed.sql
__tests__/                recommender / rounding / stats specs
```

## How the recommender works

See the header comment in [`src/domain/recommender.ts`](src/domain/recommender.ts).
Short version:

1. **e1RM per set** — RPE becomes reps-in-reserve (`RIR = 10 − RPE`); Epley on
   `reps + RIR`.
2. **Working e1RM** — exponential moving average over your recent working sets for
   that exercise.
3. **Next weight** — invert Epley for the middle of your rep range, nudge for the
   last set's RPE, clamp the change to ±15%, round to the machine's step.

Every set stores `machine_id`, `rpe`, and `e1rm` so a later personalized model
(per-machine strength offsets) has the data it needs.

## Regenerating DB types

After changing the schema:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```
