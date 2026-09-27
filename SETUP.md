# Running Rust Strength locally

The overview, features and architecture are in the [README](README.md). This
file is only about getting a development copy running.

## 1. Prerequisites

- **Node.js 20 LTS or newer**: <https://nodejs.org>. Check with `node -v`.
- **Expo Go** on your phone for quick testing, or an EAS development build.
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
`0001` through `0014`, then [`supabase/seed.sql`](supabase/seed.sql).

- **Dashboard:** paste each file into the SQL editor and run it. Run
  `0012_timed_load_type.sql` on its own, because Postgres will not use a new
  enum value in the same transaction that adds it.
- **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.

Every migration is safe to re-run.

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

## 7. Checks

```bash
npm test           # Jest unit tests
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
```

## Other scripts

| Command | What it does |
|---|---|
| `npm run legal` | Rebuilds the Privacy Policy and Terms pages from `src/legal/` and syncs them to the public site repo |
| `npm run screenshots` | Resizes phone screenshots to App Store size (see [store/screenshots](store/screenshots/README.md)) |
| `npm run icons` | Regenerates the app icons |
| `npm run db:types` | Regenerates `src/lib/database.types.ts` from a local Supabase |

## Releasing

iOS builds go through EAS:

```bash
eas build --platform ios --profile production
eas submit --platform ios --latest
```

[`store/BUILD_CHECKS.md`](store/BUILD_CHECKS.md) is the pre-release checklist.
