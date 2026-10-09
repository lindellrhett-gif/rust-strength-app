# Pre-launch legal & privacy audit — Rust Strength

Prepared by Rhett Lindell.

**Audited: 11 September 2026** against commit `1902db5`, covering every migration
through `0010_moderation_queue.sql`.

**Amended 14 September 2026** for two changes: the contact address moved to
`ruststrengthsupport@gmail.com`, and an opt-in "rest over" notification was added.
The notification is the first device permission the app can request, so the
statements about permissions below and in the privacy policy were corrected
(policy 1.3.0).

**Amended 18 September 2026** for: exercise types (weights, bodyweight, assisted)
and a full exercise catalog; more activity kinds; consent now recorded when an
account is created rather than after sign-in; a re-acceptance screen for material
document changes; the email confirmation link landing on a real page; and the
published account-deletion steps corrected to match the app (policy 1.4.1).

**Amended again 18 September 2026** for: timed exercises (sets can record how
long a hold lasted), and a friends leaderboard. The leaderboard shows accepted
friends only the totals their profile of you already showed, plus whether you
log in lb or kg so totals compare fairly; both are now disclosed (policy 1.4.2,
a patch: no new category of data and no new recipient, so nobody is asked to
accept again).

**Amended 23 September 2026 (policy 1.4.4).** New accounts are confirmed with
a code typed into the app rather than a link, after testers reported links that
were already "expired" on arrival: a confirmation link is single-use and mail
apps and security scanners open links before the recipient does. The policy's
description of what the email contains is updated to match. No change to what
is collected or who receives it, so it is a patch and nobody re-accepts.

**Amended 18 September 2026 (policy 1.4.3)** for: rest days now keep a streak
alive and count toward consistency on friends' profiles and the leaderboard.
The server works those figures out and returns only the numbers, so rest days
themselves still reach nobody; the policy now says the two figures reflect
them. Also: finished workouts can be edited and deleted, and friends' workout
time was being overstated (summed once per set) and is corrected.

This supersedes the audit of 7 September, which predated the friend feed,
reactions, XP and badges, offline storage, the moderation queue, progress charts
and the welcome cards.

---

## 0. What this is, and what it is not

This is not legal advice and was not written by a lawyer. It is a review of the
code and the documents against each other, reporting what does not line up.

**This report does not say the app is compliant, and nothing here makes it
lawsuit-proof.** Several items below genuinely need a lawyer, and they are marked
as such rather than guessed at.

**Checked:** the source, the database schema and every row-level security
policy, the generated legal documents, the live published site, the App Store
listing copy, the build configuration and the dependency tree.

**Not checkable from the code**, so the risk sits outside this review:

- **The Supabase dashboard.** Auth settings, email confirmation, rate limits,
  backups and plan tier are invisible from the code. Several items below depend
  on them.
- **The app at runtime.** Behaviour on a real phone is covered by TestFlight
  testing, not by this review.
- **Anything about the real world** — whether the name is already a trademark,
  which countries you will publish in, what your insurance covers.

---

## 1. What the app actually does

A workout logger. You record sets with weight, reps, RPE and which machine; it
estimates a one-rep max and suggests the next weight. Around that: presets, a
calendar, rest days, activities, trophies, XP and levels, progress charts, and a
friends layer with a feed of each other's sessions.

Free. No purchases, no subscription, no advertising, no analytics.

### Third parties — the complete list

| Party | Role | What it receives |
|---|---|---|
| **Supabase** | Database, authentication, hosting | Everything: account, training data, social graph |
| **Expo / EAS** | Build service | Source at build time. No user data. |
| **Apple** | Distribution | Whatever App Store Connect collects from purchasers. No data flows from the app to Apple. |
| **GitHub Pages** | Hosts the legal site | Visitor IPs in its own logs. No app data. |
| **Google (Gmail SMTP)** | Sends password reset emails for Supabase, from `ruststrengthsupport@gmail.com` | A user's email address and reset code, only when they request a reset. Never contacted by the app itself. |

**Verified: no analytics, crash reporting, advertising or attribution SDK is
present.** The dependency tree and the source were searched for every common one. The
app makes no network call to any host other than your own Supabase project.

Runtime dependencies are the Expo and React Native platform, `@supabase/supabase-js`,
TanStack Query and its storage persister, AsyncStorage, NetInfo, `expo-crypto`,
`expo-notifications` (local scheduling only — no push token is ever requested),
`react-native-svg`, `react-hook-form`, `zod` and Ionicons. All permissively
licensed. None phones home.

### Data inventory

**Given by the user:** email address, password (hashed by Supabase, never seen by
you), username and display name, optional bodyweight, training data (exercises,
weights, reps, RPE, sets, workouts, presets, planned sessions, rest days, gyms,
machines), activity data with optional distance, steps and calories,
preferences, reactions to friends' posts, and reports filed about other users.

**Generated:** timestamps, a random account id, and Supabase's server logs
including IP addresses.

**Not collected:** real name, phone number, location of any precision, photos,
video, contacts, microphone, camera, advertising identifiers, biometrics,
government identifiers, payment details, push tokens.

**Device permissions: notifications only, and only on request.** Nothing is
asked at launch. The system prompt appears when the user switches on "Alert when
rest is over" in Profile. The alert is a local notification scheduled on the
phone; the code never calls `getExpoPushTokenAsync` or `getDevicePushTokenAsync`,
so no device identifier exists to collect. The on/off choice is stored on the
device only. No new data type, so the privacy manifest is unchanged.

The notifications module adds Apple's `aps-environment` entitlement to the build
regardless of whether push is used. That is a build detail, not data collection,
but the App ID needs the Push Notifications capability enabled for signing.

---

## 2. PASS — checked and properly handled

- **Row-level security is enabled on every table**, and the policies are scoped
  to `auth.uid()`. Each one was read.
- **`profile_badges` has a select policy and nothing else.** With RLS on and no
  insert policy, a signed-in user cannot award themselves the Influencer badge
  through the API. Only the service role can write it.
- **`rpc_admin_user_text` is revoked from `authenticated` and `anon`.** The
  moderation helper that reads any user's free text is service-role only.
- **Every `SECURITY DEFINER` function checks friendship before returning another
  user's data**, or returns aggregates only. `rpc_friend_feed` gates authorship
  three ways: accepted friendship, the author's sharing preference, and no block
  in either direction.
- **The feed returns summaries, never individual sets.** That limit is in the SQL,
  not the client, so a modified app cannot widen it.
- **Account deletion works and is reachable in two taps** from Profile. It
  removes the auth user, which cascades, and explicitly clears reactions left
  elsewhere. Satisfies App Store Guideline 5.1.1(v).
- **Data export works** and now includes badges and reactions.
- **Report and block both exist**, and blocking tears down the friendship in both
  directions. Guideline 1.2.
- **Age gate and consent are recorded** at sign-up with a document version.
- **Usernames are neutral by default** (`lifter_7f3a91`) and an account is not
  searchable until the user chooses a handle. This was the serious defect found
  in the first audit and it is properly fixed.
- **The anon key in the bundle is correct by design** — it is the public key and
  is useless unless RLS is wrong, which it is not. No service-role key anywhere
  in the source or git history.
- **App Transport Security is on** as of today. Expo's default had it disabled.
- **The iOS privacy manifest is accurate** as of 16 September: five collected data
  types (email, user ID, fitness, health, other user content). Until then it
  declared `NSPrivacyCollectedDataTypeHealthAndFitness`, which is not one of
  Apple's values, so workout data was effectively undeclared. A test now checks
  every type and purpose against Apple's list. None is used for tracking; all are
  for app functionality. The App Privacy answers in `store/APP_STORE_LISTING.md`
  match it.
- **No health or results claims** anywhere in the listing copy or the welcome
  cards. There is an automated test that fails the build on a list of claim
  phrases, and another that keeps the "not medical advice" line present.
- **The published legal site matches the in-app documents**, because both are
  generated from the same source. Verified live at version 1.2.0 on 11 September;
regenerated at 1.3.0 on 14 September.

---

## 3. Fixed since the last audit

| Finding | Severity | Status |
|---|---|---|
| Sign-out left the previous account's data in the app's cache | High | Fixed — cache and its on-disk copy cleared on account change |
| Reaction rows were readable by friends, contradicting the policy's "not who left them" | Medium | Fixed in `0009` — direct reads limited to your own rows |
| Privacy manifest declared the app collects nothing | Medium | Fixed — all four data types declared |
| Privacy manifest used an invented type, `HealthAndFitness`, so workout data was undeclared | Medium | Fixed 16 September — split into Apple's `Fitness` and `Health`; a test validates every value |
| App Transport Security disabled by Expo's default | Medium | Fixed — ATS on, HTTPS only |
| Offline storage put training data on the phone, undisclosed | Medium | Fixed today — policy Sections 6, 7 and 11 now describe it |
| Reports were written and never read | Medium | Fixed in `0010` — a queue with status, plus `legal/MODERATION.md` |
| Sign-up told users to check their email when already signed in | Low | Fixed |
| No error boundary; a render crash showed a dead screen | Low | Fixed |
| Rest-over notification would have made "requests no device permissions" in the policy untrue | Medium | Fixed before shipping — policy 1.3.0 describes the one opt-in permission |

---

## 4. NEEDS FIXING BEFORE LAUNCH

**Password reset email goes through a personal Gmail account — acceptable to
start, not a long-term arrangement.** Resolved 16 September: Supabase now sends
through Gmail SMTP from `ruststrengthsupport@gmail.com`, so resets reach real
users, and policy 1.4.0 names Google as the second service provider. What remains:

- A consumer Gmail account comes with **no data processing agreement**. That is
  tolerable for a US-only launch at small volume; it is not adequate if you
  publish in the EU or UK, where GDPR expects one with every processor.
- Gmail caps sending at roughly **500 messages a day** and can suspend accounts
  that look like bulk senders. Fine for resets; not for anything larger.
- Everything depends on **that account's App Password**. If 2-Step Verification
  is turned off or the password revoked, resets stop silently. Check the Supabase
  Auth logs if users report missing emails.

Moving to a transactional provider (Mailtrap, Postmark, Resend) with your own
domain fixes all three. It needs only a change of SMTP settings in Supabase and a
one-line update to the policy's provider table.

**Decide your App Store territories, and understand what worldwide means.**
The last audit recorded a US-only launch. That decision has to be *made* in App
Store Connect — the default is all territories. If you publish worldwide, the
GDPR and UK GDPR attach: lawful basis, a data processing agreement with Supabase,
international transfer terms, and a documented response process for access and
erasure requests. The documents are written for US law and say so. **Either
restrict availability to the United States, or get the documents reviewed for the
EU before you submit.** This is the largest open legal question.

**Move Supabase off the free tier before submission.** Free projects pause after
roughly a week of inactivity. If yours pauses while a reviewer has the app open,
everything fails and you are rejected for something that is not a bug. The same
plan gets you real backups, which matters when you are holding people's entire
training history.

**Email confirmation — resolved 18 September.** With confirmation on, consent was
never recorded: acceptance was stamped only after an automatic sign-in, which an
unconfirmed email makes impossible. The sign-up request now carries the accepted
version and the age confirmation, and the trigger that creates the profile saves
them (migration 0011). Accounts created before the fix have no record and are
asked to accept on their next launch. The confirmation link now lands on
`email-confirmed.html` instead of a blank localhost page, which requires the
Supabase Site URL and Redirect URLs to be set to it.

**Create the App Review demo account** with real logged history. A reviewer who
cannot get past the sign-in screen rejects the build.

**Check the Supabase password policy** in the dashboard. The app enforces eight
characters client-side; the server should enforce at least that too, or the
client check is decoration.

**Re-acceptance when the documents change — built 18 September.** The policy
promises to ask users to accept a materially changed version. A major or minor
version bump now shows every signed-in user a consent screen before the app; a
patch bump does not. Choosing the right kind of bump is the only thing to get
right when editing the documents.

---

## 5. NEEDS ATTORNEY REVIEW

These are legal judgement calls, not engineering ones.

**Washington's My Health My Data Act, and its imitators.** This was the largest
open question in the first audit and the friend feed has made it larger. The Act
defines consumer health data broadly enough to cover training and bodyweight
data, gives individuals a private right of action, and regulates *sharing*, not
just selling. The app now shares health-adjacent summaries with other users. The
posture is defensible — the recipients are people the user explicitly accepted,
the content is a summary, and there is a switch to turn it off — but whether that
constitutes valid consent under the Act is exactly the kind of question a lawyer
should answer. Nevada and Connecticut have comparable regimes.

**The liability waiver in the Terms.** Lifting injures people. Whether your
waiver is enforceable depends on state law, how prominently it is presented, and
whether it attempts to disclaim things that cannot be disclaimed.

**Whether the disclaimers are placed prominently enough.** "Not medical or
coaching advice" appears in the Terms, the Profile screen, the welcome cards and
the App Store description. Whether that is sufficient prominence for a product
that tells people what weight to lift is a legal question, not an engineering one.

**Governing law and dispute resolution.** North Dakota is chosen. Whether you
want an arbitration clause and a class action waiver, and whether they would
hold, is a business and legal decision.

**Your insurance and your business structure.** Whether operating as a named
individual rather than through an entity is the right exposure for a product that
advises physical exertion. This has legal consequences and it is not a decision
the code can make.

---

## 6. APP STORE RISKS

**Requiring an account (Guideline 5.1.1).** Apps may not require registration
unless it is relevant to core functionality. A reviewer may ask why the app
cannot be used anonymously. Your answer is that training history syncs across
devices and the social features need an identity, which is a good answer — but
put it in the review notes rather than improvising if asked.

**User-generated content (Guideline 1.2).** You have reporting, blocking, a
moderation queue and a documented daily routine. This is now in reasonable shape.
What keeps it in shape is that there is **no free-text messaging or commenting** —
the only user-written text another person sees is a username, a display name, and
the names someone gives their own exercises. Adding comments or direct messages
would change the moderation burden completely.

**Age rating.** Expect 13+, and answer yes to user-generated content and social
features. Do not be tempted to answer no to reach 4+.

**In order:** account deletion, the privacy manifest, no tracking, no purchases,
and screenshots — the last now producible from an iPhone 16 Pro via
`npm run screenshots`.

---

## 7. PRIVACY RISKS

**The friend feed is the first real sharing this app does.** Until now a friend
saw aggregate totals. They now see each session: its name, when it happened, how
long it lasted, volume, sets, reps, which exercises, and how many records were
set. Mitigations: accepted friends only, enforced in SQL; summaries only, never
individual sets; a switch in Profile that stops it immediately; and the policy
describes exactly what a post contains.

**Reaction identities are not exposed**, as of `0009`. The feed returns counts.

**Training data now sits on the phone** for offline use. It is in the app's
private storage, protected by the operating system and the device passcode, and
cleared on sign-out, on account deletion and when the app is deleted. Disclosed
as of today.

**Username enumeration is possible but limited.** Search needs two characters,
matches a prefix, returns at most twenty, excludes blocked users in both
directions, and only ever returns accounts that have chosen a handle. It returns
a username and display name, never training data. This is the same exposure any
app with username search has. Acceptable as it is.

**`user_reports` has no retention limit.** Reports — including free text one user
wrote about another — are kept indefinitely. Consider deleting resolved reports
after a period. Low risk, but it is personal data about a third party held
forever with no stated purpose once the case is closed.

**Supabase's logs contain IP addresses.** Disclosed in Section 1 of the policy,
with retention on their schedule rather than yours, which the policy also says.

---

## 8. SECURITY RISKS

**The database is the strong part.** Row-level security on every table, scoped
policies, definer functions that check friendship, and an admin function that
`authenticated` cannot call. All of it was read.

**There is no rate limiting beyond Supabase's defaults.** Username search, friend
requests and report filing are all callable as fast as the API allows. For an app
with no users this is theoretical; revisit if it grows.

**No multi-factor authentication.** Reasonable for a training log.

**The offline cache is protected by the operating system, not by you.** iOS file
protection and the device passcode are the defence. For workout data that is
proportionate. It would not be for anything more sensitive.

**No dependency scanning, because there is no CI.** Running `npm audit` by hand
before each release is the cheap version. Standing warning: **never run
`npm audit fix --omit=dev` in this project** — it prunes devDependencies and
breaks the toolchain.

**No secrets in the repository.** Verified across the working tree and the
history.

---

## 9. INTELLECTUAL PROPERTY

**"Rust Strength" has still not been trademark-searched.** This is the one IP item
that could force a rename after launch, and a bundle identifier cannot be changed
once published. Search the USPTO TESS database, and check the App Store for
similar names, before the listing goes live. "Rust" is used in software contexts
and the risk is not zero.

**Every icon and glyph is drawn in-house** in `TrophyIcon.tsx` and
`BodyChart.tsx`. No stock art, no licensed illustrations, no emoji.

**Fonts are the system fonts plus Ionicons**, which is MIT.

**Exercise names are generic and descriptive** and not protectable by anyone.

**The real-world weight comparisons are factual** — a US semi is capped at
80,000 lb by federal law, a 747-400's maximum takeoff weight is 875,000 lb. Facts
are not protectable and these are accurate.

**No third-party licences screen is shipped.** Most permissive licences require
attribution. Generating one is cheap and worth doing before launch.

---

## 10. MARKETING CLAIMS

**No claim is made about strength gains, weight loss, injury prevention or any
health outcome.** The listing copy says the app suggests weights from numbers you
enter. That is a capability claim about software, and it is substantiated.

**Automated tests enforce this.** The welcome cards are checked against a list of
claim phrases, and the "not medical or coaching advice" line is asserted present.
If marketing copy is later written into the app, the test fails.

**Watch this if you ever advertise.** The FTC's Health Products Compliance
Guidance is the relevant standard and it applies to store copy, social posts and
anything an influencer says on your behalf. If you give someone the Influencer
badge and they make a claim you would not make, that is your problem too.

---

## 11. MISSING DOCUMENTS

| Document | Status |
|---|---|
| Privacy Policy | Published, v1.4.4 |
| Terms of Service | Published, v1.4.4 |
| Support page | Published |
| Account deletion page | Published — Apple wants a web-reachable route |
| Incident response plan | `legal/INCIDENT_RESPONSE.md` |
| Moderation runbook | `legal/MODERATION.md` |
| EULA | Not needed; Apple's standard EULA applies by default |
| Cookie policy | Not needed; no web app, no cookies |
| **Data processing agreement with Supabase** | Missing. Only required if you publish outside the US. Supabase offers one. |
| **Third-party licences screen** | Missing. Cheap to add. |
| **Retention schedule for `user_reports`** | Missing. |

---

## 12. PRIORITISED ACTIONS

### CRITICAL — before you submit

1. **Decide and set your App Store territories.** US-only, or get the documents
   reviewed for the EU.
2. **Move Supabase to a paid plan** so the project cannot pause during review,
   and so backups exist.
3. **Trademark-search "Rust Strength."** The bundle identifier is permanent.
4. **Create the demo account** with real history and put the credentials in the
   App Review notes.

### HIGH — strongly recommended before launch

5. **Email confirmation: done.** Set the Supabase Site URL and Redirect URLs to
   `email-confirmed.html` so the link lands somewhere useful.
6. **Take Section 5 to a lawyer**, with the Washington My Health My Data question
   first.
7. **Test the offline support on a real phone.** It has never run on one. That is
   a data-loss risk rather than a legal one, but losing somebody's logged session
   is the fastest route to a one-star review.
8. **Check the Supabase password policy** matches the client.

### MEDIUM

9. Add a third-party licences screen.
10. Set a retention period for resolved reports.
11. **Re-acceptance prompt: done.** Bump the minor version for material changes.
12. Start the daily moderation check now, so it is a habit before it matters.

### LOW

13. Run `npm audit` before each release. Never with `--omit=dev`.
14. Revisit rate limiting if the app grows.

---

## 13. Decisions only you can make

None of these can be settled from the code.

1. **Which countries you publish in.** Everything about the GDPR follows from it.
2. **Whether to operate as an individual or form an entity.** You are currently
   named personally in documents for a product that advises physical exertion.
3. **Whether to carry insurance.**
4. **Whether to keep the name**, after searching for it.
5. **Whether to accept the Washington My Health My Data risk**, mitigate it
   further, or exclude that state.
6. **How fast you commit to answering reports.** The runbook says daily. That is
   a promise you are making to Apple and to your users.

---

## 14. Pending: the running update (not released yet)

The running feature is being built on the `feature/running` branch, and the
released app contains none of it. Sections 1 to 13 describe the released app.

### Done on the branch (legal version 1.5.0)

The documents on the branch now describe the running update. They are **not
published**: they were rebuilt with the site sync turned off, so the public
site still shows version 1.4.4, which matches the released app.

1. **Precise location.** The Privacy Policy no longer says no location is
   collected. It describes recording a route only between Start and Finish
   (`runs.route`, migration 0015), what is stored with each run, privacy
   zones, saved routes, running settings, the per-run feed and map choices,
   the server-side trimming (`run_shared_route`, migration 0021), the run in
   progress kept on the phone, export (migration 0023) and deletion.
2. **Steps.** The policy says a recorded run's step total is saved with the
   run (`activities.steps`, migration 0017) and today's count never leaves
   the phone (`src/lib/steps.ts` sends nothing).
3. **Permissions.** The policy lists all three: notifications, location
   ("While Using the App" only, checked: the code calls only
   `requestForegroundPermissionsAsync`) and Motion & Fitness.
4. **Apple Maps** is listed as a service provider, since map tiles for the
   area on screen are fetched from Apple. Routes are drawn on the phone and
   are not sent to Apple by the app.
5. **Terms.** Section 1 now says run figures are GPS and sensor estimates,
   and adds a short outdoor running safety paragraph.
6. **Privacy manifest.** `NSPrivacyCollectedDataTypePreciseLocation` is in
   `app.json`. Fitness was already declared.
7. **Lock Screen.** While a run records, a Live Activity shows its time,
   distance and pace on the Lock Screen and in the Dynamic Island, visible to
   anyone holding the phone. It is created on the phone with no push token,
   and the policy says so and how to turn it off.
8. **Fixed while checking:** the privacy zone screen labelled a radius as
   "Size across", which would have made a zone hide half the distance the
   user expected. It now says "Radius", as does the server's error message.

Version 1.5.0 is a minor bump, so every signed-in user is asked to accept
again when they first open 1.1.

### Still to do at release

1. **Publish the documents** with `npm run legal` (with the site repo checked
   out next to this one), then push `rust-strength-site`. Do this when 1.1 is
   released, not before, or the public policy describes features users don't
   have. `lastUpdated` in `src/legal/config.ts` is set just before the
   production build, so the app and the site show the same date.
2. **App Store privacy labels.** Add **Precise Location** (linked to the user,
   used for app functionality, not tracking). Steps already fall under the
   **Fitness** label.
3. **Attorney.** Location combined with fitness data adds to the Washington My
   Health My Data question in section 5. This has not been reviewed, and is not
   claimed to be compliant.
