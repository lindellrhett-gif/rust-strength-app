# Running Rust Strength locally

The overview, features and architecture are in the [README](README.md). This
file is only about getting a development copy running.

## 1. Prerequisites

- **Node.js 20 LTS or newer**: <https://nodejs.org>. Check with `node -v`.
- **Expo Go** on your phone for quick testing, or an EAS development build.
  Recording a run with the screen locked needs a development build; see
  section 6.
- A free **Supabase** account: <https://supabase.com>.

> Keep the project out of OneDrive or any other synced folder. Syncing the
> thousands of files npm unpacks turns a two-minute install into hours and can
> corrupt `node_modules`.

## 2. Install

```bash
npm install
```

The project is on **Expo SDK 57**. If Expo Go updates to a newer SDK and
refuses to open the app, realign with `npm install expo@latest` and then
`npx expo install --fix`.

## 3. Create the Supabase project

1. In the Supabase dashboard, create a new project and save the database
   password.
2. Under **Project Settings → API**, copy the **Project URL** and the
   **anon public** key.

## 4. Apply the database schema

Run every file in [`supabase/migrations/`](supabase/migrations) in order,
`0001` through `0023`, with [`supabase/seed.sql`](supabase/seed.sql) right
after `0002`.

- **Dashboard:** paste each file into the SQL editor and run it. Run
  `0012_timed_load_type.sql` on its own, because Postgres will not use a new
  enum value in the same transaction that adds it.
- **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.

Running a migration twice in a row is harmless (`npm run test:db` checks
this). Don't go back and re-run an old one after later ones: later
migrations reshape what the earlier ones made.

`0015_running.sql` turns on PostGIS, which every Supabase project has
available.

### On the live project

A new project takes all of them. The live project already has `0001` to
`0016`, and the rest go in at different times, because the released 1.0 app
keeps using the same database:

| Migration | When to run it on the live project |
|---|---|
| `0017` to `0019`, `0021` to `0023` | Any time before 1.1 ships. They only add things the 1.0 app never calls. A development build of 1.1 needs all of them to save and show runs |
| `0020_streaks_count_activities.sql` | **Only when 1.1 is released.** It makes every activity count toward the streak, and 1.0 still counts workouts alone, so friends would see a streak the app doesn't |

### Auth emails

Sign-up and password reset both use a 6-digit code rather than a link, because
link-scanning mail filters open single-use links before the user does. Paste
the templates in [`supabase/email-templates/`](supabase/email-templates) into
**Authentication → Email Templates**. The README in that folder covers
delivery problems.

For quick local testing you can turn email confirmation off under
**Authentication → Providers → Email**.

## 5. Configure the app

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
```

The anon key is designed to ship inside the app. Row Level Security protects
the data, not the secrecy of that key. Never put the service role key in
`.env` or anywhere in the app.

## 6. Run it

```bash
npx expo start -c
```

Scan the QR code with the Camera app (iOS) or Expo Go (Android). `-c` clears
the bundler cache so a new `.env` is picked up.

### A development build, for running

Expo Go can't keep recording a run with the screen locked, so test running
on a development build:

```bash
eas build --profile development --platform ios
```

Install it from the link EAS prints, then start the bundler with
`npx expo start --dev-client`.

The app has a second piece of native code besides the app itself: the widget
extension in `targets/widget` that draws a run on the Lock Screen and in the
Dynamic Island. `@bacons/apple-targets` adds it to the Xcode project at
prebuild, and EAS signs it as its own app extension, with the app's bundle
identifier plus `.widget`. The first build after adding it needs EAS to
create that extension's identifier and provisioning profile, which means
signing in to Apple for that one build (see `store/BUILD_CHECKS.md`). Its
Swift can't be built on Windows; `eas build --platform ios --profile
ios-check` compiles everything without any Apple sign-in. Make a new development build whenever a
native module is added or changed (anything that edits `app.json` plugins or
adds a package with native code); JavaScript changes don't need one. A build
made before a native module existed still opens, and that feature is simply
left out.

To test a run without leaving the house, the recorder's auto-pause and GPS
cleaning are covered by simulated runs in `__tests__/fixtures/gpx/`
(regenerate them with `node scripts/make-gpx-fixtures.js`).

## 7. Checks

```bash
npm test           # Jest unit tests
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run test:db    # Migrations, RLS and SQL functions, in PGlite (a few minutes)
```

`npm run test:db` runs the real migrations in PGlite, Postgres compiled to
WebAssembly with PostGIS, so it needs no Docker or Supabase CLI. It proves
the SQL and the Row Level Security policies, not the deployment, so still
apply new migrations to a development project before the live one.

Some database tests replay requests the app builds itself, from
`supabase/tests/fixtures/`. After changing what the app sends to a run RPC,
regenerate them with `UPDATE_FIXTURES=1 npx jest runningSaveContract`
(in PowerShell: `$env:UPDATE_FIXTURES=1; npx jest runningSaveContract`).

## Other scripts

| Command | What it does |
|---|---|
| `npm run legal` | Rebuilds the Privacy Policy and Terms pages from `src/legal/` and syncs them to the public site repo, if it is checked out next to this one. Set `SITE_DIR` to a folder that doesn't exist to rebuild without publishing |
| `npm run screenshots` | Resizes phone screenshots to App Store size (see [store/screenshots](store/screenshots/README.md)) |
| `npm run icons` | Regenerates the app icons |
| `npm run db:types` | Regenerates `src/lib/database.types.ts` from a local Supabase |

## Releasing

iOS builds go through EAS:

```bash
eas build --platform ios --profile production
eas submit --platform ios --latest
```

[`store/BUILD_CHECKS.md`](store/BUILD_CHECKS.md) is the pre-release checklist,
and [`store/RELEASE_1.1.md`](store/RELEASE_1.1.md) lists what the running
update needs on top of it.
