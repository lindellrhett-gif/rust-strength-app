# Records of processing and impact assessment

Bluestem Software LLC's record of processing activities for Rust Strength, and
its data protection impact assessment, for the UK GDPR and the EU GDPR.
Written November 7, 2026, against app version 1.2 (branch
`feature/nutrition`), migrations `0001` to `0031` and legal documents 1.6.0.

**Not reviewed by a lawyer.** This file records what the code does and our
reasoning in good faith. It does not say the app meets the GDPR or any other
law. Points we could not check, or where the law is unclear, are marked
**Uncertain** or **Not checked**.

**Status since this was written (November 7, 2026, later the same day).** The body
below describes the code as first found. Since then:

- **R2 and A8, half live.** Migration `0033_profile_names.sql` adds
  `rpc_profile_names`, which returns only names, and `src/data/friends.ts` reads
  through it; it went on the live database on November 7, 2026.
  `0034_profiles_owner_only.sql`, which limits the `profiles` table to its owner,
  waits for 1.2's release day. Both are tested in
  `supabase/tests/friendship-integrity.test.mjs`. Until 0034 is live, R2 stays high.
- **Also fixed, and live since November 7, 2026** (found in `legal/UK_ONLINE_SAFETY.md`):
  `0032_friendship_integrity.sql` stops a friendship being inserted already
  accepted, accepted by its requester, moved to other people, or requested across a
  block.
- **Finding 3, partly done.** The Privacy Policy (English and French) now says Gmail
  sends the sign-up and password codes and holds the support inbox. Replacing
  consumer Gmail is still open.
- **Finding 5 and A5, done.** `legal/INCIDENT_RESPONSE.md` has the UK, EU, Canada and
  Quebec steps and an incident register.
- **Finding 7 and A19, done.** The sharing question has two equal buttons, "Keep
  private" and "Share".
- **Finding 8 and A22, done.** `legal/MODERATION.md` has the statement-of-reasons
  email.
- **Run share cards** now start with "Show the route" off.
- **Canada's minimum age is 14** (decided November 7, 2026), for Quebec's rule on
  children under 14. The age is set by the phone's region like the EEA's 16.
- **Still open:** the export gaps (finding 4), consent history (finding 6), personal
  bests revealing bodyweight (finding 2), the representatives, the postal address,
  and the other actions in 2.9 not listed here.

**Keep it current.** Update Part 1 in the same change as any migration that
adds a table or column, any new recipient, and any new feature. Review Part 2
at least once a year and before shipping a new feature (see 2.10).

---

# Part 1: Record of processing activities

## 1.1 Why we keep one

Article 30(1) of the GDPR and of the UK GDPR requires a controller to keep a
written record of its processing. Article 30(5) exempts organisations with
fewer than 250 employees, but not when the processing is not occasional or
includes special category data. Both apply here: the app processes data every
day, and much of it is health data (Article 9). So the exemption does not
apply, even though the LLC has one person.

We must show this record to the ICO or an EU supervisory authority if asked
(Article 30(4)).

## 1.2 Controller

| | |
|---|---|
| Controller | Bluestem Software LLC, a one-person US limited liability company |
| Postal address | See `src/legal/config.ts` `postalAddress` (to be filled in) |
| Email | ruststrengthsupport@gmail.com (`LEGAL.contactEmail`) |
| Privacy Officer | Published by title, "Privacy Officer", at the same email. In practice the owner |
| UK representative (UK GDPR Art. 27) | Not yet appointed |
| EU representative (GDPR Art. 27) | Not yet appointed |
| EU Digital Services Act legal representative (DSA Art. 13) | Not yet appointed |
| Data protection officer | None appointed. See the note below |
| Joint controllers | None |
| What this covers | The Rust Strength iPhone app, its Supabase backend and the support inbox |

**Representatives.** The LLC has no office in the UK or the EU, and its
processing is not occasional, so Article 27 asks for a representative in each.
`LEGAL.ukRepresentative` and `LEGAL.euRepresentative` are empty, and the
documents say one will be named before the app is offered there. Keep the UK
and EU storefronts off until both are filled in.

**Data protection officer.** Article 37(1)(c) requires one when the core
activities include processing special category data "on a large scale".
Health data is core to the app. Today the user count is small, so we think it
is not large scale. **Uncertain:** the GDPR sets no number. Revisit as the
user count grows, and ask a lawyer when deciding.

## 1.3 Recipients and transfers

These apply to every activity in 1.5. Each activity names the ones it uses.

| Recipient | Role | Where | What it receives | Safeguard for UK and EEA data |
|---|---|---|---|---|
| **Supabase** (contracting entity Supabase Pte. Ltd) | Processor: database, sign-in (Supabase Auth), Edge Functions, logs | AWS us-east-1, Virginia, USA | Everything the app stores | Supabase's Data Processing Addendum (version 1, August 1, 2026), part of its Terms. It incorporates the EU Standard Contractual Clauses (Commission Implementing Decision (EU) 2021/914) and the UK Addendum. Nothing to sign |
| **Amazon Web Services** | Supabase's sub-processor (hosting) | us-east-1, USA | As Supabase | Through Supabase's DPA. Supabase's full sub-processor list was **not checked** |
| **Google, consumer Gmail** (ruststrengthsupport@gmail.com) | Sends sign-up confirmation codes and password reset codes (Supabase SMTP settings). Also the support inbox: requests, reports, appeals | USA (**not checked**) | Email addresses and one-time codes. Every email people send us | **None. Consumer Gmail has no data processing agreement. Open gap** (see 2.9) |
| **RevenueCat, Inc.** | Processor: Pro plans, purchase checks with Apple, Pro status, the manage-plan screen | USA | The random account id, purchase details, app and device details needed for purchases, App Store country and currency, answers given in its purchase-help screen | **Not checked:** whether RevenueCat's DPA is accepted and includes the SCCs and UK Addendum |
| **Apple** | Its own controller: Sign in with Apple, App Store payments, Apple Maps tiles | Apple's | Sign-in: email (or private relay) and account id. Payments: everything about the purchase. Maps: map-area requests and IP address from the phone, no routes | Apple's own terms. Not our processor |
| **Google, Sign in with Google** | Its own controller | Google's | Google confirms the account and sends email, account id, name and picture link. We drop the name and picture before storage (migration 0029) | Google's own terms. Not our processor |
| **Open Food Facts** (French non-profit) | Its own controller | Server location **not checked** | Barcode or search words, sent from the phone, with IP address and a User-Agent naming the app (`OFF_USER_AGENT`). No account data | The request goes from the phone, not from us |
| **Recipe websites** | Their own controllers | Anywhere | The page request and IP address, when the phone loads a link the person chose | None needed from us. The link is not sent to us |
| **Accepted friends** (other users) | Recipients the person chooses | Anywhere | What section 4 of the Privacy Policy lists. See P6 | Not a transfer by us |
| **Authorities** | If the law requires | | Only what is required | Case by case |

Not recipients of user data: Expo/EAS (builds only), GitHub (source code, and
GitHub Pages hosts the website, which logs visitors' IP addresses under
GitHub's own terms).

**Transfers (Chapter V). Uncertain.** The LLC itself is in the United States,
and people send their data to it straight from the app. The EDPB's Guidelines
05/2021 say that a person sending their own data directly to a controller
outside the EEA is not a "transfer" under Chapter V; the controller is still
bound by the GDPR through Article 3(2). Supabase is then a US-hosted processor
for a US controller. We rely on Supabase's DPA in any case, and the Privacy
Policy says so. Two open points for a lawyer:

- Recital 7 of Decision 2021/914 limits the 2021 SCCs to importers whose
  processing is not already within the GDPR's scope. How that fits a
  processor for an Article 3(2) controller is unclear. The Commission has said
  it is working on clauses for that case; whether they have been adopted was
  not checked.
- The ICO's guidance on restricted transfers was not checked against this
  set-up.

No transfer impact assessment has been written. Whether Supabase or
RevenueCat is certified under the EU-US Data Privacy Framework or the UK
extension was not checked.

## 1.4 Security measures

General description for Article 30(1)(g) and Article 32. Each activity in 1.5
refers to these by number.

| # | Measure | Where |
|---|---|---|
| S1 | **Row-level security on every table.** 35 tables, 35 `enable row level security` statements, each with policies scoped to `auth.uid()`. Owner-only for training, runs, steps and every food diary table | `supabase/migrations/*.sql` |
| S2 | **Server-side limits on what others see.** Friends' data comes only through `SECURITY DEFINER` functions that check accepted friendship, the sharing switch and blocks, and return summaries: never sets, notes, rest days, routes or the food diary. Reaction rows are readable only by whoever left them (0009). Signed-out callers cannot run any function (0016). Shared routes are trimmed on the server; `run_shared_route` cannot be called directly (0021) | 0008, 0009, 0016, 0021, 0024 |
| S3 | **Admin tools are not in the app.** Moderation runs in the Supabase SQL editor as the service role. `rpc_admin_user_text` is revoked from signed-in and signed-out users. The `service_role` key lives only in Supabase (Edge Function secrets), never in the app or the repo | 0010, `legal/MODERATION.md`, `supabase/functions/` |
| S4 | **Passwords hashed by Supabase Auth** (bcrypt, per `legal/INCIDENT_RESPONSE.md`). We never see them. Apple and Google passwords never reach us. Sign in with Apple tokens are never stored; at deletion they are fetched and revoked at once | Supabase Auth, `supabase/functions/delete-account/index.ts` |
| S5 | **Encryption in transit.** HTTPS/TLS for all traffic; App Transport Security on (per `legal/LEGAL_AUDIT.md`). Encryption at rest is Supabase's; **not checked** here | |
| S6 | **On the phone.** The session, an offline copy of recent data (kept up to 7 days, `src/lib/queryClient.ts`) and a run in progress are in AsyncStorage, inside the app's sandbox. The app does not encrypt it itself; iOS Data Protection does once the phone has a passcode. Cleared on sign-out, account change and account deletion | `src/lib/supabase.ts`, `src/lib/queryClient.ts`, `src/providers/AuthProvider.tsx` |
| S7 | **Tests of the database rules.** `supabase/tests/*.test.mjs` check RLS, the friend functions, sharing, export and deletion | `supabase/tests/` |
| S8 | **Accounts that reach the data.** Only the owner has access. Two-factor sign-in on Supabase, GitHub, Apple Developer, RevenueCat, Expo and Gmail is recommended in `legal/PRIVACY_REQUESTS.md`. **Not checked** that it is on | |
| S9 | **No third-party SDKs that collect data.** No analytics, advertising, crash reporting or tracking SDKs, and no push tokens (per `legal/LEGAL_AUDIT.md`) | `package.json` |
| S10 | **Incidents.** `legal/INCIDENT_RESPONSE.md` (contain, assess, notify). See 2.7, finding 5 | |

## 1.5 Processing activities

Health data, below, means what Privacy Policy section 2 treats as health
information: training data, bodyweight, calories burned, steps and everything
in the food diary. Whether every item is "data concerning health" under
Article 4(15) is **uncertain**. We treat all of it as health data, which is the
safer reading.

Explicit consent (Article 9(2)(a)) is given at sign-up and on the re-consent
screen, by a separate checkbox (`HEALTH_CONSENT_LABEL` in
`src/domain/consent.ts`). It is recorded by the profile's `terms_version`
(1.6.0 or later) and `terms_accepted_at`; see P10.

### P1. Account and sign-in

| | |
|---|---|
| Purpose | Create and secure the account. Sign in with email and password, Apple or Google. Confirm the email address with a code. Reset a password with a code. Start the profile in the phone's weight unit |
| Legal basis | Art. 6(1)(b), needed to provide the app. Securing accounts: Art. 6(1)(f) |
| Data subjects | Users: 13 and over, or 16 and over when the phone's region is in the EEA. Includes children aged 13 to 17 |
| Personal data | **Supabase Auth:** email address; password hash; account id (random UUID); created, confirmed and last sign-in times; the sign-up metadata the app sends (`terms_version`, `age_confirmed`, `unit`). For Apple or Google: the provider's account id, email (Apple may give a private relay address) and whether it is verified. Google's name, picture link and other profile fields are removed before storage by `strip_sign_in_profile` (0029). Supabase Auth also keeps sessions and refresh tokens; as we understand its schema these include IP address and device user agent (**not checked** on the live project). **One-time codes** for confirmation and reset. **`profiles`:** `username` (starts as a random handle such as `lifter_7f3a91`, 0007), `display_name` (optional), `username_chosen`, `unit`, `created_at`. **On the phone:** the session |
| Source | The person; Apple or Google |
| Recipients | Supabase. Gmail (email address and code, each time a code is sent). Apple or Google for their own sign-in |
| Transfers | Supabase: DPA with SCCs and UK Addendum. **Gmail: no DPA (open gap).** Gmail likely keeps a copy of every code email in the account's Sent folder (**not checked**) |
| Retention | While the account exists. On deletion: the `delete-account` Edge Function revokes Sign in with Apple, deletes the RevenueCat customer (only when `REVENUECAT_SECRET_API_KEY` is set), then calls `rpc_delete_my_account`, which deletes the auth user. Every table's user reference is `on delete cascade` (checked in all migrations), so everything goes. The app then signs out and clears its cache. A deletion done by hand in the Supabase dashboard cascades the same way but does not contact Apple or RevenueCat. Codes expire under Supabase's "Email OTP expiration" setting |
| Security | S1, S4, S5, S6, S8 |

### P2. Training log and progress features

| | |
|---|---|
| Purpose | Record and show training. Estimate one-rep maxes, suggest the next weight, work out stats, streaks, the weekly body chart, trophies, XP, levels and badges. Run the rest timer |
| Legal basis | Art. 6(1)(b) and, as health data, Art. 9(2)(a) explicit consent |
| Data subjects | Users |
| Personal data | **`profiles`:** `body_weight` (optional; also set from the latest weigh-in, P5), `equipment`, `target_rep_low`/`high`, `rest_seconds`, `rest_auto`, `level_seen`, `featured_trophies`. **`workouts`:** start and end times, name, note, preset. **`sets`:** exercise, machine, weight, reps, RPE, warm-up flag, bodyweight flag, assist and added weight, hold time, target reps, estimated 1RM, order, time. **`workout_exercises`:** planned slots and suggested weight. **`workout_templates`, `template_exercises`:** presets (name, note, exercises, target sets and reps). **`planned_sessions`:** date, title, note, preset. **`rest_days`:** date, note. **`gyms`** (name), **`machines`** (label, increment, notes, gym), custom **`exercises`** (name, muscle group, equipment, load type). **`activities`:** kind, name, time, duration, and optional distance, unit, steps, calories, note, `share_to_feed`. **`profile_badges`:** badges the owner awards by hand, with a note. **On the phone only:** the rest-alert choice, onboarding progress |
| Source | The person; worked out by the app |
| Recipients | Supabase. Accepted friends see totals and personal bests (P6) |
| Transfers | Supabase: DPA |
| Retention | Until the person deletes the item, or the account (P1) |
| Security | S1, S2, S5, S6, S7 |

### P3. Runs and location

| | |
|---|---|
| Purpose | Record runs with the phone's location: distance, pace, route, splits, best efforts, estimated calories, spoken updates. Privacy zones, saved routes, running settings. Show friends a trimmed outline, only if chosen |
| Legal basis | Art. 6(1)(b) and Art. 9(2)(a). Location is not special category data, but the routes are precise and can show where someone lives, so we treat them with the same care |
| Data subjects | Users |
| Personal data | **`runs`:** source (GPS, manual, treadmill), distance, moving and elapsed time, climb, effort (1 to 10), splits, the **route** (one line of latitude, longitude, altitude and seconds from the start), distance and moving time at each point, saved route, `map_visibility` (default `private`). **The run's `activities` row:** time, duration, steps, calories, title, notes, `share_to_feed`. **`run_best_efforts`.** **`run_privacy_zones`:** label, centre point, radius (200 to 1,000 m), up to 10. **`saved_routes`:** name, route line, distance. **`run_preferences`:** auto-pause, audio cues, `share_default`, `map_default` (default `private`), weekly goal. **On the phone:** the run in progress, with its location points, until saved or discarded |
| Source | The phone's location ("While Using the App" only, never "Always"), while a run records; the person |
| Recipients | Supabase. Friends: distance, time and pace; the outline only when the run's map is shared, trimmed on the server (first and last 200 m removed, and any start or end inside a privacy zone, then simplified). Apple Maps: map tiles for the area on screen, from the phone, with IP address, no route. Share cards: made on the phone, shared only where the person sends them |
| Transfers | Supabase: DPA |
| Retention | Until the person deletes the run, zone or route, or the account (P1). The phone's copy of a run in progress goes when it is saved or discarded |
| Security | S1, S2, S5, S6. Privacy zones are readable only by their owner, through `rpc_my_privacy_zones` (0021) |

### P4. Steps

| | |
|---|---|
| Purpose | Show today's steps on the phone. Store a recorded run's steps. If the person turns on "Share daily steps": the steps leaderboard and the Steps trophy |
| Legal basis | Art. 6(1)(b) and Art. 9(2)(a). Sharing with friends is a separate choice: the switch, off by default |
| Data subjects | Users |
| Personal data | Daily step counts from Motion & Fitness, read on the phone. A run's total in `activities.steps`. Only while sharing is on: **`daily_steps`** (day, steps, update time), one row per day, synced for the past week each time the app opens. `profiles.share_steps` (default false, 0024). The step goal is on the phone only |
| Source | The phone's motion sensors, with permission |
| Recipients | Supabase, only while sharing is on (and run totals). Friends see daily totals on the leaderboard and their profile of the person, only while sharing is on |
| Transfers | Supabase: DPA |
| Retention | Turning sharing off deletes every uploaded total (`rpc_set_share_steps`). While it is on, rows stay with no other limit; the Steps trophy counts lifetime shared steps. Deleted with the account |
| Security | S1, S2, S5 |

### P5. Food diary and goal calculator (Rust Strength Pro)

| | |
|---|---|
| Purpose | Keep the food diary: look up foods, add up calories and nutrients, estimate a calorie goal, show reports and the weight trend |
| Legal basis | Art. 6(1)(b) and Art. 9(2)(a) |
| Data subjects | Users with Pro (13 and over, or 16 and over by EEA region) |
| Personal data | **`diary_entries`:** day, meal, food, source, barcode, name, brand, amount, unit, grams, calories and 15 nutrients, time logged. **`foods`** the person owns (own foods, recipes, copies of Open Food Facts products), with `food_portions` and `recipe_items`. **`saved_meals`, `saved_meal_items`.** **`diary_days`:** a note (up to 2,000 characters) and whether the day is complete. **`water_logs`:** day, millilitres. **`body_weights`:** date, kilograms; the latest is copied to `profiles.body_weight` (trigger `sync_profile_body_weight`). **`nutrition_goals`:** start date, calories, protein, carbs, fat, macro mode, other targets, meal split. **`nutrition_settings`:** meal names, kcal or kJ, exercise calories on or off, net carbs, water goal, and the calculator's inputs: height, **birth year**, sex for the equation (optional), activity level, goal weight, weekly change. The camera reads barcodes on the phone; the picture is not kept. Searches of our USDA catalog are not saved. A recipe's link is not stored |
| Source | The person; Open Food Facts and the USDA FoodData Central catalog for nutrition values |
| Recipients | Supabase. Open Food Facts: barcode or search words, from the phone, with IP address, not linked to the account. Recipe websites: the page request. **Nobody else:** not friends, the feed, the leaderboard or share cards (owner-only RLS on all 11 tables). But see 2.7, findings 1 and 2, on bodyweight |
| Transfers | Supabase: DPA |
| Retention | Until the person deletes the entry, or the account (P1) |
| Security | S1, S5, S6, S7 (`supabase/tests/nutrition.test.mjs`) |

### P6. Friends, feed, reactions and leaderboard

| | |
|---|---|
| Purpose | Let people find each other by a chosen username, add friends, see friends' stats, personal bests, feed, session grid and leaderboard, react to posts, and block |
| Legal basis | Art. 6(1)(b) for the friend features the person uses. Showing health-related summaries to friends: Art. 9(2)(a), by turning sharing on (the Privacy Policy's table says the same) |
| Data subjects | Users; their friends; people who send or receive requests; blocked users |
| Personal data | **`profiles`:** `username`, `display_name`, `username_chosen`, `share_workouts` (default false for new accounts from 1.2, migration 0031), `share_choice_at` (0030), `share_steps`, `featured_trophies`. **`friendships`:** who asked whom, status, times. **`user_blocks`:** who blocked whom, time. **`feed_reactions`:** post, person, reaction, time. **Shown to friends, worked out on the server:** totals (workouts, volume, reps, sets, time, activity time, run distance), streaks, 30-day consistency, the dates the person trained, per-exercise personal bests, friend count, reactions received (a count), unit, featured trophies, shared daily steps. **Feed posts** (only with sharing on): session or activity name, time, length, volume, sets, reps, exercise names, record count; for runs, distance, time, pace and the trimmed outline if chosen. User-typed names of exercises, gyms, machines, presets, workouts and activities can appear to friends |
| Source | The person; worked out by the server |
| Recipients | Supabase. Accepted friends, as above. Anyone signed in: the username and display name of accounts that chose their own handle, by search (3 letters or more, 20 results at most, blocks excluded). People with a pending request: username and display name. See 2.7, finding 1 |
| Transfers | Supabase: DPA. Friends anywhere, at the person's choice |
| Retention | Until the friendship, block or reaction is removed, or the account is deleted. Reactions on a post go with the post (trigger, 0008). Reactions a person left go with their account |
| Security | S1, S2, S7. Existing accounts made before 1.2 keep whatever sharing setting they had |

### P7. Rust Strength Pro purchases

| | |
|---|---|
| Purpose | Sell Pro (monthly, yearly or Lifetime) through the App Store and unlock its features. Let server code check Pro |
| Legal basis | Art. 6(1)(b) |
| Data subjects | Users who look at or buy Pro |
| Personal data | **`subscriptions`** (mirror written only by the `revenuecat-webhook` Edge Function): Pro active, product, period type (normal, trial, intro), store, expiry, will renew, update time. **At RevenueCat:** the account id (the same random UUID; the app sends no email or name, `src/lib/purchases.ts`), plan, purchase date, price and currency, Apple transaction ids, trial, renewal, refund, expiry, app and device details needed for purchases, App Store country, anything typed in its purchase-help screen. No health data |
| Source | Apple, through RevenueCat; the person |
| Recipients | RevenueCat (processor). Apple (its own controller and the seller). Supabase |
| Transfers | RevenueCat: **DPA and safeguard not checked.** Supabase: DPA |
| Retention | The mirror row goes with the account. The RevenueCat customer is deleted at account deletion when the secret key is set; the webhook skips deleted accounts so it does not recreate them. Apple keeps its own purchase records |
| Security | S1 (users can only read their own row; no write policy), S3, S5 |

### P8. Moderation and reports

| | |
|---|---|
| Purpose | Receive reports about users and content, decide on them, act (reset a name, ban, delete), tell the person what was decided and why (Terms section 6), and handle appeals |
| Legal basis | Art. 6(1)(f): keeping the app and the people using it safe; App Store Guideline 1.2 expects it. For EU users, Art. 6(1)(c) where the Digital Services Act's notice-and-action and statement-of-reasons duties (Arts. 16 and 17) apply. **Uncertain** which DSA duties apply to the app; see the Terms and `legal/UK_ONLINE_SAFETY.md` for the UK |
| Data subjects | People who report; people reported; people who email a report, who need not have an account |
| Personal data | **`user_reports`:** reporter, reported person, reason (harassment, impersonation, inappropriate name, spam, other), details (up to 1,000 characters), status, created, reviewed time, reviewer's note. **Read during review** (`rpc_admin_user_text`): the reported person's username, display name and names of exercises, machines, gyms, presets, workouts and activities. Bans are Supabase Auth's own setting. **In the Gmail inbox:** emailed reports, our replies, appeals. Free text could mention health; we do not ask for it |
| Source | The reporter; the reported person's own data |
| Recipients | Supabase. Gmail. The owner, who reviews every report; no automated moderation |
| Transfers | Supabase: DPA. **Gmail: no DPA** |
| Retention | Report rows are deleted when either the reporter's or the reported person's account is deleted (cascade, 0007), along with the reviewer's note. Otherwise no limit is set. Emails: no limit is set. See 2.9 |
| Security | S1 (a reporter can read only reports they filed), S3, S8 |

### P9. Security and server logs

| | |
|---|---|
| Purpose | Run and secure the service, find faults, detect abuse, investigate incidents |
| Legal basis | Art. 6(1)(f) |
| Data subjects | Users; anyone who calls the API |
| Personal data | Supabase's platform logs: API requests (path, time, IP address, user agent), database, Auth and Edge Function logs. Supabase Auth's audit log entries in the `auth` schema, which may include email address and IP address (**not checked**; they may not be removed when the account is deleted). Email rate-limit counters |
| Source | Created automatically |
| Recipients | Supabase, AWS |
| Transfers | Supabase: DPA |
| Retention | Under Supabase's schedule for the plan. The Privacy Policy says logs and backups "may persist for a short period". The free plan's log retention and what happens to Auth audit entries **were not checked** in the dashboard |
| Security | S3, S8 |

### P10. Privacy requests and records of consent

| | |
|---|---|
| Purpose | Answer requests to see, correct, delete, restrict, move or stop data, and appeals. Show that people agreed to the Terms, gave explicit consent to health information and confirmed their age (Art. 7(1)). Know whether someone has answered the sharing question |
| Legal basis | Art. 6(1)(c): the GDPR's rights articles and Art. 7(1). Health data in a request, if any, is used only to answer it (**uncertain** which Art. 9 condition covers that; most likely the original explicit consent, or Art. 9(2)(f) if it becomes a dispute) |
| Data subjects | Users; anyone who writes to us |
| Personal data | **Consent record on `profiles`:** `terms_version`, `terms_accepted_at`, `age_confirmed_at` (a time, never a date of birth); a copy of the sign-up metadata in Supabase Auth; `share_choice_at`. The phone's region decides the age asked for but is **not stored** (`src/lib/deviceRegion.ts`). **Request log** (`legal/PRIVACY_REQUESTS.md`): date received, email address, what was asked, date answered, what was done, kept in a spreadsheet outside the repo. **Correspondence** in Gmail. **Exports** run in the SQL editor for someone who cannot sign in, sent only to the account's address |
| Source | The person; the app |
| Recipients | Supabase. Gmail. Whatever service holds the request-log spreadsheet (**not stated** anywhere; see 2.9) |
| Transfers | Supabase: DPA. **Gmail: no DPA.** Spreadsheet host: unknown |
| Retention | The consent record is overwritten at each re-acceptance, so only the latest is kept, and it goes with the account. The request log is kept "at least two years" with no upper limit. Emails: no limit set |
| Security | S1, S8. Identity is checked before acting (account's own email address, `legal/PRIVACY_REQUESTS.md`) |

---

# Part 2: Data protection impact assessment

## 2.1 Why a DPIA

Article 35(1) asks for an assessment before processing that is likely to
result in a high risk. Three things put Rust Strength there:

- **Health data.** Training, bodyweight, steps and the food diary are special
  category data (Article 9), handled every day.
- **Children are likely to use it.** The minimum age is 13 (16 by EEA region).
  Children's data is a recognised high-risk factor (EDPB guidelines on DPIAs,
  WP248 rev.01), and the UK Children's Code, standard 2, requires a DPIA for an
  online service likely to be accessed by children.
- **Location data.** Recorded runs store precise, timed routes, which can show
  where someone lives and their routine.

There is also a social layer: friends, a feed and a leaderboard.

Whether the processing is "large scale" under Article 35(3)(b) is
**uncertain** and does not change the answer: the criteria above are enough.

## 2.2 The processing

**Nature.** An iPhone app writes to one Supabase project (Postgres with
PostGIS, Supabase Auth, two Edge Functions) in AWS us-east-1. Each person's
rows are protected by row-level security. Friends' data is served only by
database functions that check friendship. The phone keeps a short-lived
offline copy. Recipients are listed in 1.3.

**Scope.** The ten activities in 1.5. Categories: account data, training,
activities, runs and routes, steps, the food diary and calculator inputs,
social data, purchase status, reports, logs. Number of accounts at this
review: ______ (owner to fill in). Kept while the account exists.

**Context.**
- Users are 13 and over (16 and over by EEA region) and can be teenagers.
- People choose to use it to track their own training. Everything except the
  account and the health consent is optional.
- The social layer is small: friends only, summaries only, no messages,
  comments, photos, public profiles, follower counts, recommendations or
  endless feed. From 1.2 it looks bigger: large posts, a grid of a friend's
  sessions and a count of their accepted friends, with no new data.
- Pro (the food diary) is paid.
- One person runs the company and does all moderation, support and requests.

**Purposes.** Run the features the person uses: the training log, runs,
steps, the food diary, the friend features, Pro. Keep the service secure.
Handle reports and requests. No advertising, profiling for marketing, sale of
data or analytics.

## 2.3 Consultation

- **Users:** not consulted. TestFlight testers' feedback has shaped features
  (for example, codes instead of links in emails, per `legal/LEGAL_AUDIT.md`)
  but not on privacy specifically.
- **DPO:** none (see 1.2).
- **Lawyer:** none. Not reviewed by a lawyer.
- **Processors:** Supabase's DPA was read; RevenueCat's was not.

## 2.4 Necessity and proportionality

### Lawful basis

Contract (Article 6(1)(b)) for running the app; explicit consent
(Article 9(2)(a)) for health data; legitimate interests (Article 6(1)(f)) for
security and moderation; legal obligation (Article 6(1)(c)) for requests and
records. The Privacy Policy, section 13, states the same. The consent model
has known weak points; see risk R12.

### Data minimisation choices in the code

| Choice | Where |
|---|---|
| New accounts get a random handle (`lifter_` and six characters) that says nothing about the person | `handle_new_user`, 0007 and 0028 |
| Not findable by search until the person chooses a handle; search needs three letters and returns at most 20, never blocked users | `username_chosen`, `rpc_search_users`, 0007 |
| No real name asked. Google's name and picture are removed before storage; Apple is asked for the email only | 0029, Privacy Policy section 1 |
| No date of birth. Age is a ticked box, stored as a time. A birth year is stored only if the goal calculator is used | 0007, `nutrition_settings.birth_year` |
| The phone's region is read on the phone to choose 13 or 16 and is never stored or sent | `src/lib/deviceRegion.ts`, `src/domain/age.ts` |
| The sign-up sends only `lb` or `kg` from the phone's settings, not the region | 0028 |
| The food diary is private: owner-only RLS on all 11 tables, never in the feed, leaderboard or share cards | 0027 |
| Daily steps stay on the phone unless "Share daily steps" is on (off by default). Turning it off deletes what was uploaded | 0024 |
| Run maps are private by default, per run and in the default setting. A shared map is a trimmed, simplified outline made on the server. The full route never reaches anyone else's phone | 0015, 0021 |
| Location only while a run records, "While Using the App" only, no geofencing | Privacy Policy section 1, Consumer Health Data Privacy Policy section 1 |
| "Show my sessions in the feed" starts off for new accounts from 1.2, with one question when the first friend is accepted | 0030, 0031, `src/domain/sharePrompt.ts` |
| Feed posts and the grid on a friend's profile are summaries; individual sets and notes never leave the server | `rpc_friend_feed`, `rpc_friend_posts`, both through `private.feed_posts` (0035) |
| Reactions show counts, not who reacted, enforced in the database | 0009 |
| Rest days are never shown to anyone; only the streak and consistency figures reflect them | 0008, Privacy Policy section 4 |
| No analytics, advertising, crash-reporting or tracking SDKs; no push tokens | `legal/LEGAL_AUDIT.md` |
| Camera: only the barcode number is used. Photos: add-only | Privacy Policy section 1 |
| RevenueCat gets the random account id, not the email, and no health data | `src/lib/purchases.ts` |
| Open Food Facts requests carry no account data. The USDA catalog is in our database, and searches are not saved | `src/domain/nutrition/openFoodFacts.ts`, 0027 |
| A recipe import keeps the recipe, not the link | `legal/LEGAL_AUDIT.md` |
| The offline copy on the phone expires after 7 days and is cleared on sign-out | `src/lib/queryClient.ts` |

### Storage limitation

Data is kept while the account exists and deleted at once with it (P1). Gaps:
no limit for dormant accounts; no limits for closed reports, the request log
or the support inbox; and backup and log retention not confirmed with
Supabase. See 2.9.

### Accuracy and rights

People can change or delete most of their data in the app. "Download my data"
(`rpc_export_my_data`) and "Delete account" work in the app at once. The
export leaves some things out; see 2.7, finding 4.

### Processors

Supabase is under its DPA. RevenueCat's DPA was not checked. Consumer Gmail
has none. See 1.3.

## 2.5 Children: the UK Children's Code

The ICO's Age Appropriate Design Code applies to online services likely to be
accessed by children in the UK. Users aged 13 to 15 and 16 to 17 are the age
ranges that matter here. Where the app cannot tell a child from an adult, the
Code's alternative is to apply its standards to everyone. Rust Strength mostly
does that: its private defaults are the same for every account. This is our
reading of the Code; **not reviewed by a lawyer**.

| Standard | How the app meets it | Gaps |
|---|---|---|
| 1. Best interests of the child | Private defaults, no ads, no data sales, guardrails on calorie goals | |
| 2. DPIA | This document | Review yearly (2.10) |
| 3. Age-appropriate application | Same high-privacy defaults for everyone; weight-loss goals only for adults | Age is self-declared (R8, R9) |
| 4. Transparency | Plain-English policies in English and French; the share question explains what friends would see; Terms tell under-18s to have a parent review them | No short version written for teenagers |
| 5. Detrimental use of data | No push notifications to bring people back; no endless feed; rest days keep streaks alive | Streaks, levels and the leaderboard are engagement features (R13). Calorie tracking (R6) |
| 6. Policies and community standards | Terms section 6; daily human review of reports (`legal/MODERATION.md`) | |
| 7. Default settings | Feed sharing, daily steps and run maps all start off | Once a handle is chosen, the account is findable by search and there is no switch to hide it. Accounts made before 1.2 keep sharing on |
| 8. Data minimisation | 2.4 | |
| 9. Data sharing | Shared only with processors and with friends the person accepts | |
| 10. Geolocation | Off until a run starts; only while recording; iOS shows it is in use; shared maps off by default and trimmed | If the person sets the map default to "friends", it stays that way for later runs instead of returning to off (R7) |
| 11. Parental controls | None, so nothing hidden from the child | |
| 12. Profiling | Only for the core features (next weight, 1RM, calorie goal); none for ads or recommendations | |
| 13. Nudge techniques | One sharing question, asked once | "Share" is the main button and "Not now" the secondary one (2.7, finding 7) |
| 14. Connected toys and devices | Not applicable | |
| 15. Online tools | Export, delete, report and block, all in the app | |

## 2.6 Risks to people

How to read the table. **Likelihood** (Remote, Possible, Probable) and
**severity** (Minimal, Significant, Severe) are of harm to people if the
measures listed were not there. **Residual** (Low, Medium, High) is with the
measures in place today. Actions are in 2.9.

| # | Risk | Likelihood | Severity | Measures in place | Residual |
|---|---|---|---|---|---|
| R1 | **Breach of the Supabase project**: a leaked `service_role` key, an RLS mistake on a new table, a taken-over Supabase or GitHub login, or an incident at Supabase. Exposes emails, health data, food diaries, routes that show homes, and children's data | Possible | Severe | S1 to S10. No payment data, real names, photos or dates of birth to lose. RLS and a policy in the same migration as every new table (incident plan checklist). Database tests | Medium |
| R2 | **The whole profile row is readable through the API by friends and by anyone with a pending friend request, in either direction**, including `body_weight` (the latest weigh-in), equipment, unit, consent and age times and sharing settings. A stranger can create a pending request by sending one to any chosen username. The Privacy Policy says nobody can see your bodyweight. The app's screens read only the username and display name | Possible | Significant | None in the database. The app does not show it | **High until fixed** |
| R3 | **A friend can work out someone's bodyweight from their personal bests.** For bodyweight exercises the stored weight is bodyweight plus added weight, and for assisted ones bodyweight minus assistance (0011). `rpc_friend_prs` returns each exercise's best weight to friends | Possible | Minimal to Significant | Accepted friends only | Medium |
| R4 | **A friend sees more than the person meant**: session summaries, training dates, personal bests, totals, run stats; or a friend turns out to be someone else | Possible | Significant | Sharing off by default from 1.2, asked once. Summaries only, never sets or notes. Food diary and rest days never shown. Per-run feed switch; maps off by default. Remove or block at any time; turning sharing off works at once | Low |
| R5 | **A child sees or posts harmful text**: usernames, display names (shown in search to anyone signed in, once the account has chosen a handle), or names of exercises, gyms, machines, presets, workouts and activities, including contact details meant to move a conversation elsewhere | Possible | Significant | No messages, comments, photos or public profiles. Requests must be accepted. Report from a profile; block. A person reviews reports daily and can reset a name, ban or delete. Anyone can report illegal content by email. No automated filter | Low to Medium |
| R6 | **Eating-disorder harm from calorie tracking, especially for teenagers** | Possible | Severe | See below | Medium |
| R7 | **Location exposure from run routes**: home, school, routine | Possible | Severe | Location only while recording, "While Using" only. Full route visible only to its owner. Maps off by default. Shared outline trimmed on the server (first and last 200 m, and any start or end inside up to 10 privacy zones of 200 to 1,000 m), then simplified. Share-card routes trimmed on the phone. Zones and saved routes private. The Lock Screen shows time, distance and pace, not the map. Gaps: a route through a zone in the middle shows there; 200 m alone may not hide a home without a zone; a regular route still shows a routine; a "friends" map default persists; a share card is out of our hands once sent | Low to Medium |
| R8 | **Age self-declaration is easy to get round**: a child under 13 (under 16 in the EEA) can tick the box | Probable | Significant | Box at sign-up and on every re-consent; Terms; accounts deleted when reported; the same private defaults for everyone; little data; no ads | Medium |
| R9 | **The device-region age rule is imperfect**: an EEA resident with a non-EEA region setting is asked for 13; the region is not stored, so we cannot show later which age was asked or find EEA accounts; Quebec's under-14 rule cannot be told apart from the rest of Canada | Probable | Significant | Region read fresh on the phone each time; the Terms set 16 by where the person lives, not the setting; same private defaults | Medium |
| R10 | **Data loss on the free Supabase plan**: point-in-time recovery is a paid add-on and not on; whether the free plan keeps a daily backup we can restore was **not checked**; free projects may be paused after a period of inactivity (**not checked**) | Possible | Significant | People can download their data; the phone keeps up to 7 days offline | Medium |
| R11 | **Consumer Gmail holds email addresses, codes and every support, request and report email**, under Google's consumer terms, with no DPA and no transfer safeguard | Probable (as a gap) | Minimal to Significant | Code emails contain only the address and the code | Medium |
| R12 | **Consent may not be valid**: the app cannot be used without it (Art. 7(4), "freely given"); children of 13 to 15 in the UK give explicit consent to health data; withdrawing means deleting data or the account; only the latest acceptance is kept | Possible | Significant | Separate, unticked checkbox naming the data; documents readable in English and French before agreeing; withdrawal explained; single entries can be deleted | Medium (legal uncertainty) |
| R13 | **Streaks, levels, trophies and the leaderboard push teenagers to over-train or compare themselves** | Possible | Minimal to Significant | Friends-only leaderboard; rest days keep a streak; no notifications to come back; no endless feed; reaction counts only; no body or food comparisons | Low |
| R14 | **Someone holding the phone sees data**: the offline copy, a run in progress, Live Activities on the Lock Screen | Possible | Minimal to Significant | App sandbox and iOS Data Protection; cleared on sign-out; Live Activities can be turned off | Low |
| R15 | **An abuser deletes their account and starts again, and the reports about them disappear** (cascade on `reported_id`) | Possible | Significant | Block; report again; daily review | Medium |
| R16 | **US authorities' access to data held in the US** | Remote | Significant | SCCs and UK Addendum in Supabase's DPA; little data beyond what the features need; no sale | Low to Medium (**uncertain**, no transfer impact assessment) |

### R6 in detail: calorie tracking and teenagers

What the code does today (`src/domain/nutrition/goals.ts`,
`src/domain/nutrition/goalForm.ts`, `app/nutrition/goals.tsx`):

- **Weight-loss goals are for adults only.** Age is worked out from the birth
  year typed in, taking the lower possible age (one year less, since the
  birthday is unknown). Under 18 by that measure:
  - the goal must come from the calculator, set to maintain or gain;
  - a calorie goal typed in by hand is refused;
  - a goal weight below today's weight is refused.
- **A minimum for everyone.** No goal under 800 kcal a day is saved, whether
  from the calculator or typed in. The most is 10,000 kcal.
- **A warning floor.** Below 1,200 kcal (women, and anyone who leaves sex
  out) or 1,500 kcal (men), the screen warns "Check with a doctor or dietitian
  before eating this little" and asks again before saving. It is a warning,
  not a block.
- **A rate cap.** The calculator works with at most 1 kg a week of change.
- **The birth year is always asked for** on the goal screen, and must give an
  age of 13 to 120.
- **The Terms (section 1)** say to talk to a doctor or registered dietitian
  first, especially after an eating disorder, and not to rely on the diary to
  manage a condition.
- **The diary is private**: no social comparison, nothing on the leaderboard.
- **It is paid** (Pro). That limits who has it, but it is not a safeguard.

What it does not do:

- The birth year is typed by the person and can be changed to unlock adult
  goals.
- Logging food, calories and weigh-ins has no age limit; only goals do.
- The rules run in the app only. The database accepts any goal from 0 to
  20,000 kcal (`nutrition_goals`).
- There is no link to eating-disorder support services anywhere in the app.
- An adult can save a goal under the floor after the warning.

## 2.7 What this review found in the code

Found while checking the documents against the code. None has been fixed
here; each is an action in 2.9.

1. **Profile rows are readable by friends and pending requesters (R2).** The
   policy `profiles_select_self_or_friend` (0002) lets the owner, accepted
   friends and either side of any pending request select the whole row. No
   later migration narrows it, and no column privileges are set.
   `supabase/tests/security.test.mjs` checks which rows are visible, not which
   columns. Found by reading the migrations; **not tested** against the live
   project.
2. **Personal bests reveal bodyweight (R3).** `rpc_friend_prs` (0008) returns
   `max(sets.weight)` per exercise; for bodyweight and assisted exercises that
   number includes the person's bodyweight.
3. **The Privacy Policy's provider table understates Gmail.** Section 5 of
   `src/legal/privacy.ts` says Gmail "sends password reset emails" only.
   Section 1 and `legal/LEGAL_AUDIT.md` say it also sends sign-up
   confirmation codes. The French translation should be checked too. The
   support inbox is also Gmail, which the table does not mention.
4. **The export is incomplete.** `rpc_export_my_data` (0027) leaves out
   `workout_exercises` (planned slots and suggested weights),
   `template_exercises` (the exercises inside presets), reports the person
   filed (`user_reports`) and the sign-in provider identity.
5. **The incident plan has no UK or EU section.** `legal/INCIDENT_RESPONSE.md`,
   as read on November 7, 2026, covers the US, New Zealand and Australia.
   The UK GDPR and the GDPR ask for:
   - notice to the ICO or the supervisory authority within 72 hours of
     becoming aware (Art. 33). With no EU establishment there is no lead
     authority, so it is likely each authority where affected people live
     (**uncertain**);
   - notice to the people affected when the risk is high (Art. 34);
   - a log of every breach (Art. 33(5)).
6. **Only the latest consent is kept.** `useAcceptTerms`
   (`src/data/privacy.ts`) overwrites `terms_version` and `terms_accepted_at`.
   The version still points to the wording in the code's history, so consent
   can be shown, but earlier acceptances are not kept.
7. **The sharing question leans towards sharing.** In
   `src/components/SharePrompt.tsx`, "Share" is the main button and "Not now"
   the secondary one. "Not now" suggests it will ask again, but it never does.
8. **Moderation runbook and the Terms.** The Terms (section 6) promise to tell
   people what was decided and why. `legal/MODERATION.md`, as read on
   November 7, 2026, has no step for that.

## 2.8 Residual risk and conclusion

With the measures in place, most risks are low or medium. **R2 is high until
fixed.** It is a gap between what the Privacy Policy promises and what the
database allows, and it touches health data that may belong to children.

In our assessment, once R2 is fixed and the "before the UK and EU" actions in
2.9 are done, no risk stays high, so prior consultation with the ICO or a
supervisory authority (Article 36) is not needed. The medium risks that
remain (R1, R3, R6, R8, R9, R10, R12, R15) are accepted for now, for these
reasons:

- **R1:** the data cannot be made less sensitive without removing the
  features.
- **R6:** the guardrails are reasonable for a general fitness app, but rely on
  a self-typed birth year.
- **R8, R9:** stronger age checks would mean collecting more data (IDs, face
  scans) from everyone, for a service whose social side is small.
- **R12:** the consent model is common in fitness apps, but it has not been
  tested for this one.

**Uncertain:** an authority could weigh R6, R8 and R12 differently, given
health data and teenage users.

This conclusion has not been reviewed by a lawyer.

## 2.9 Open actions for the owner

**Before the UK and EU storefronts are switched on**

| # | Action | Risk or reason |
|---|---|---|
| A1 | Appoint a UK representative (UK GDPR Art. 27), an EU representative (GDPR Art. 27) and an EU DSA legal representative (DSA Art. 13). Fill in `ukRepresentative` and `euRepresentative`, and update 1.2 | 1.2 |
| A2 | Replace consumer Gmail as the code sender with a transactional email provider that offers a written DPA with SCCs and the UK Addendum. Delete the old code emails from Gmail's Sent folder. Update the provider table in `src/legal/privacy.ts` and its French translation (finding 3) | R11 |
| A3 | Decide where the support inbox lives. A consumer Gmail inbox holds requests, reports and appeals with no DPA. A business mailbox with a DPA would close that gap | R11 |
| A4 | Fill in `postalAddress` in `src/legal/config.ts` | 1.2 |
| A5 | Add UK and EU breach steps to `legal/INCIDENT_RESPONSE.md`: 72 hours, Arts. 33 and 34, a breach log (finding 5) | R1 |
| A6 | Check RevenueCat's DPA, accept it, and note the safeguard in 1.3. Confirm `REVENUECAT_SECRET_API_KEY` is set in production so deletion removes the RevenueCat customer | P7 |
| A7 | Check whether the ICO data protection fee is owed (`store/INTERNATIONAL.md`) | |

**Before or with the 1.2 release**

| # | Action | Risk or reason |
|---|---|---|
| A8 | Stop other people reading the whole profile row. For example: limit the `profiles` select policy to your own row, and give friends and requesters the username and display name through a `SECURITY DEFINER` function or a narrow view. Add a test that checks columns, not just rows | R2 (high) |
| A9 | Decide how to handle personal bests on bodyweight and assisted exercises: return only the added weight (or reps) to friends, or say in the Privacy Policy that these figures include bodyweight | R3 |
| A10 | Add the missing tables to `rpc_export_my_data` (finding 4) | Rights |
| A11 | Turn on two-factor sign-in everywhere `legal/PRIVACY_REQUESTS.md` lists, and confirm it | R1 |

**Decisions to make**

| # | Decision | Risk or reason |
|---|---|---|
| A12 | Lawyer review: of this DPIA, the consent model (R12), transfers (1.3), the EEA age rule (R9), Quebec under 14, and the French translations | R9, R12 |
| A13 | Backups: upgrade the Supabase plan for daily backups or point-in-time recovery, or keep encrypted backups of your own (with a retention limit). Confirm what the free plan keeps and whether it can pause | R10 |
| A14 | Set retention limits for: closed reports, the request log (now "at least two years" with no upper limit), support emails, and accounts unused for a long time. Decide whether reports should outlive an account's deletion; that needs the foreign keys changed, a stated legal basis and a line in the Privacy Policy (0007 explains the trade-off) | Storage limitation, R15 |
| A15 | Check Supabase's log retention and its Auth audit log. If audit entries outlive deletion, decide whether to switch off writing them to the database, or say so in the Privacy Policy | P9 |
| A16 | Say where the request-log spreadsheet is kept, and add that service to 1.3 | P10 |
| A17 | Eating-disorder safeguards: add a link to support services (by country) next to the goal screen and the below-floor warning; consider enforcing the 800 kcal minimum and the under-18 rule in the database too | R6 |
| A18 | Run maps for younger users: consider making a "friends" map default go back to off after each run, or asking the person to add a privacy zone the first time they share a map | R7 |
| A19 | Give "Share" and "Not now" equal weight on the sharing question, and use wording that does not suggest it will ask again | Children's Code standard 13 |
| A20 | Consider a word filter for usernames and display names, and a switch to hide an account from search | R5, standard 7 |
| A21 | Consider keeping a history of consent acceptances rather than only the latest | R12 |
| A22 | Add a step to `legal/MODERATION.md` for telling the person what was decided and why, without naming the reporter | Finding 8 |
| A23 | Revisit the DPO question as the user count grows | 1.2 |

## 2.10 Review

Review this DPIA at least once a year, and before shipping any of these:

- the **AI coach**, listed as a Pro feature but not built
  (`src/domain/subscription.ts`). It would likely send training data to a new
  processor, so it needs this assessment and the Privacy Policy updated first;
- public profiles, comments, direct messages, photos or video;
- recommendations of people or posts;
- new sensors or data sources, such as Apple Health;
- an Android app;
- any new recipient of personal data;
- a change of hosting region or provider.

Also review it after any breach, a complaint to an authority, or a change in
the guidance this relies on.

| Review | Date | By | What changed |
|---|---|---|---|
| First version | November 7, 2026 | | Written for 1.2 and legal 1.6.0 |
| | | | |

## 2.11 Sign-off

I have read this record and impact assessment, accept the residual risks in
2.8, and will carry out or decide the actions in 2.9.

| | |
|---|---|
| Name | ______________________ |
| Role | Owner, Bluestem Software LLC |
| Signature | ______________________ |
| Date | ______________________ |
| Next review due | ______________________ |

## Sources

The links below were not re-checked when this was written. Open each one
before relying on it.

- GDPR (Regulation (EU) 2016/679), Articles 3(2), 4(15), 5, 6, 7, 8, 9, 27,
  30, 32 to 37, Chapter V: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- UK GDPR and the Data Protection Act 2018:
  https://www.legislation.gov.uk/eur/2016/679/contents
- Commission Implementing Decision (EU) 2021/914 (Standard Contractual
  Clauses): https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj
- EDPB Guidelines 05/2021 on the interplay between Article 3 and Chapter V:
  https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052021-interplay-between-application-article-3_en
- Article 29 Working Party, Guidelines on DPIAs (WP248 rev.01), endorsed by
  the EDPB: https://ec.europa.eu/newsroom/article29/items/611236
- ICO, Age appropriate design code:
  https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/
- Digital Services Act (Regulation (EU) 2022/2065), Articles 13, 16 and 17:
  https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- Supabase Data Processing Addendum: https://supabase.com/legal/dpa
