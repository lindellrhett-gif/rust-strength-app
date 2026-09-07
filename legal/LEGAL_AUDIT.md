# Pre-launch legal & privacy audit — Gym App

**Audit date:** 7 September 2026
**Audited against:** the actual code at `C:\dev\gym-app`, not assumptions about it.
**Scope decisions confirmed with the owner:** US-only launch, 13+ minimum age, username search retained (with the leak fixed), free with no purchases.

> This is an engineering audit, not legal advice. It identifies risks and implements
> technical mitigations. It does not make the app lawsuit-proof, and several items
> below need a qualified attorney.

---

## 1. What the app actually does

A workout tracker with an opt-in social layer. Users log lifting sessions and other
activities; the app estimates a one-rep max and suggests the next weight. Friends can
see each other's aggregate stats and trophies.

**No payments. No advertising. No analytics. No tracking SDKs. No device permissions.**

### Third-party services — complete list

| Service | Role | What it receives | Disclosed |
|---|---|---|---|
| **Supabase** | Auth, Postgres database, hosting | Email, hashed password, and all app data | Yes — Privacy Policy §5 |
| Expo / EAS | Build tooling and OTA delivery | No end-user personal data at runtime | N/A |

Every runtime dependency (19 packages) is **MIT licensed** — verified programmatically.
No copyleft obligations, no attribution requirements beyond retaining licence text.

### Data inventory

| Data | Why | Where | Shared with friends? |
|---|---|---|---|
| Email address | Account identity, sign-in | Supabase `auth.users` | **No** |
| Password | Authentication | Hashed by Supabase; never in our code | No |
| Username / display name | Friend discovery | `profiles` | Yes (searchable) |
| Bodyweight *(optional)* | Fills weight for bodyweight exercises | `profiles.body_weight` | **No** |
| Training data (exercise, weight, reps, RPE, sets) | Core function | `sets`, `workouts` | Aggregates only |
| Activity data (duration, distance, steps, calories) | Activity tracking | `activities` | Totals only |
| Gym / machine names | Rounding weights to real increments | `gyms`, `machines` | No |
| Preferences (unit, rep range, equipment) | App behaviour | `profiles` | No |
| Reports filed | Abuse review | `user_reports` | No |
| Timestamps | Durations, streaks, history | throughout | Workout dates only |
| IP address | Standard server logs | Supabase infrastructure | No |

**Not collected:** real name, phone, location (any precision), photos, video, contacts,
microphone, camera, advertising identifiers, biometrics, government ID, payment data.

---

## 2. PASS — appears properly handled

- **No secrets in client code.** Scanned for JWTs, service-role keys, hardcoded
  passwords — none found. Only the Supabase URL and `anon` key are shipped, which is
  their designed use; they are protected by row-level security.
- **`.env` is gitignored.** Not committed.
- **Row-level security on every table.** All 15 user tables have RLS enabled with
  owner-only policies. Friend access goes through `security definer` functions that
  check the friendship first.
- **No logging of user data.** Zero `console.*` calls in `app/` or `src/`.
- **TLS everywhere.** All Supabase traffic is HTTPS.
- **Password hashing.** Handled by Supabase; the app never sees or stores a password.
- **No permissions requested.** `android.permissions` is explicitly `[]`; no iOS
  usage-description strings are needed because no permission-gated API is used.
- **No tracking.** iOS privacy manifest declares `NSPrivacyTracking: false` with no
  tracking domains. No App Tracking Transparency prompt is required.
- **Licences clean.** All 19 runtime dependencies MIT.
- **Data minimisation.** The age gate stores *"they confirmed 13+"*, not a date of
  birth. Bodyweight is optional and the app works without it.

---

## 3. FIXED IN THIS PASS

### 🔴 Email addresses were being published to strangers
**Was:** `handle_new_user()` derived the username from the email local-part, so
`john.smith@gmail.com` became the searchable public handle `johnsmith` — and
`rpc_search_users` exposed it to any signed-in user with a 2-character prefix search.
This published a derived form of every user's email address without consent.

**Fixed:** new accounts get a neutral random handle (`lifter_7f3a91`). Users are not
searchable at all until they deliberately choose a username, and the search minimum is
now 3 characters. Migration `0007`.

> ⚠️ **Existing accounts created before this migration still have email-derived
> usernames.** They are now hidden from search (`username_chosen` defaults to false),
> but the value is still in the database. If you have real users already, run:
> `update profiles set username = 'lifter_' || substr(md5(random()::text), 1, 6), username_chosen = false;`

### 🔴 No account deletion — App Store blocker
Apple Guideline 5.1.1(v) requires in-app account deletion for any app with account
creation. **Added:** `rpc_delete_my_account()` and a confirm-by-typing-DELETE flow at
Profile → Privacy & legal. Deletes the `auth.users` row, which cascades to every table.

### 🔴 No report or block — App Store blocker
Guideline 1.2 requires apps with user-generated content to provide a way to report
objectionable content, block abusive users, and publish contact info. **Added:**
`user_reports` and `user_blocks` tables, a report modal with five reasons, one-tap block
from a friend's profile, a blocked-user list, and a published contact email.

### 🟠 No consent or age record
**Added:** signup now requires two explicit confirmations (13+, and acceptance of the
Terms and Privacy Policy) with links to both documents, recorded on the profile as
`terms_accepted_at`, `terms_version` and `age_confirmed_at`.

### 🟠 No data export (CCPA right to access)
**Added:** `rpc_export_my_data()` returns everything held about the caller as JSON,
surfaced as "Download my data" via the share sheet.

### 🟠 Weak password minimum
Was 6 characters; raised to 8.

### 🟡 No legal documents
**Added:** full Privacy Policy and Terms of Service written against the actual schema,
readable in-app, and exported to `legal/PRIVACY.md` / `legal/TERMS.md` for hosting.

---

## 4. NEEDS FIXING BEFORE LAUNCH

| # | Item | Why it matters |
|---|---|---|
| 1 | **Fill the five placeholders in `src/legal/config.ts`** | Legal entity, contact email, governing state, and two public URLs. The documents are unenforceable and Apple will reject a listing without a reachable privacy policy URL. |
| 2 | **Host the policy publicly** | Apple requires a Privacy Policy URL on the App Store listing itself, not just in-app. `legal/PRIVACY.md` is ready to publish. |
| 3 | **Set up the support inbox** | Guideline 1.2 requires published contact for UGC apps. It must be monitored — you commit in the Terms to acting on abuse reports within 24 hours. |
| 4 | **Rename the app** | "Gym App" is generic and almost certainly unregistrable; `com.gymapp.app` is likely already taken on both stores. See §7. |
| 5 | **Build a way to read reports** | `user_reports` collects them, but there is no admin view. You can read them in the Supabase dashboard for now — but you need a defined process before launch, not just a table. |
| 6 | **Turn email confirmation back on** | It was disabled for testing. Leaving it off lets anyone register with someone else's address. |

---

## 5. NEEDS ATTORNEY REVIEW

1. **Washington My Health My Data Act (and Nevada SB370).**
   This is the single most significant legal exposure. Training data, bodyweight and
   calories are arguably "consumer health data" under MHMDA, which is drafted very
   broadly. It requires a **separate** consumer health data privacy policy (distinct
   from the general one), affirmative consent before collection, separate consent before
   any sharing, and a right to deletion. Critically, **it carries a private right of
   action** under Washington's Consumer Protection Act — meaning individuals can sue.
   It applies to consumers in Washington regardless of where you are.
   *Recommendation:* have an attorney determine whether MHMDA applies to you. If it
   does, you need a separate health-data policy and consent flow. This is not something
   I should decide for you.

2. **Injury liability and the weight-suggestion feature.**
   The app tells people how much weight to lift. The Terms disclaim this heavily
   (§1, §12, §13) and I have avoided any language implying the suggestions are safe or
   prescriptive. But disclaimers do not always survive, and many states will not enforce
   a limitation of liability for personal injury. An attorney should review §1 and §13
   specifically.

3. **Limitation of liability cap ($100) and the venue clause.**
   Standard drafting, but enforceability varies by state, and consumer-protection
   statutes in some states override them.

4. **No arbitration clause.** I deliberately did not add one. They are effective at
   limiting class exposure but are heavily regulated, easy to draft unenforceably, and
   arguably inappropriate for a free app. Your attorney's call.

5. **Full erasure of abuse reports on account deletion.** Deleting an account currently
   deletes reports filed against that user, so someone can shed an abuse history by
   re-registering. Retaining them would need a stated legal basis and a policy change.
   Flagged rather than done silently.

---

## 6. APP STORE RISKS

| Risk | Status |
|---|---|
| Account deletion (Apple 5.1.1(v)) | ✅ Implemented |
| UGC: report + block + contact (Apple 1.2) | ✅ Implemented |
| Privacy Policy URL on listing | ⚠️ Needs hosting |
| Privacy nutrition labels | ⚠️ Must be completed in App Store Connect. Declare: Contact Info (email, linked to identity), Health & Fitness, User Content, Identifiers (user ID). Mark all as **not used for tracking** and **not used for advertising**. |
| iOS privacy manifest | ✅ Added to `app.json` |
| Age rating | Declare 12+ (Apple) / Teen (Google) because of unmoderated user-to-user content. Do **not** declare 4+. |
| Google Play Data Safety form | ⚠️ Must be completed. Same disclosures; declare data is encrypted in transit and deletable. |
| Google Play account deletion URL | ⚠️ Play also requires a **web** deletion request URL, not just in-app. You need a page for this. |
| Health data declaration | Declare Health & Fitness. You do **not** use HealthKit, so the stricter HealthKit rules don't apply. |
| Generic app name | ⚠️ May be rejected as non-distinctive; see §7. |

---

## 7. INTELLECTUAL PROPERTY

- **Code:** written for this project. No copied code.
- **Dependencies:** all MIT. Keep the licence texts in the build (standard tooling does).
- **Icons:** all trophy and body-chart icons are original SVG paths authored here — no
  third-party icon set is embedded. `@expo/vector-icons` (MIT, Ionicons) is used for tab
  icons and is redistributable.
- **Fonts:** system fonts only. No licensing issue.
- **Exercise names:** generic ("Barbell Bench Press"). Not protectable, no issue.
- **⚠️ App name and bundle ID.** "Gym App" is descriptive and very unlikely to be
  registrable as a trademark; `com.gymapp.app` is probably taken. Before launch, pick a
  distinctive name, run a USPTO TESS search and an App Store search, and update
  `app.json` (`name`, `slug`, `bundleIdentifier`, `package`, `scheme`) plus
  `LEGAL.appName`. **Changing a bundle ID after release is not possible** — get this
  right first.

---

## 8. SECURITY RISKS

| Finding | Severity | Status |
|---|---|---|
| Email-derived public usernames | High | ✅ Fixed |
| Password minimum of 6 | Medium | ✅ Raised to 8 |
| `decode-uri-component` DoS (GHSA-vcc3-ghjq-m6fr) | Medium | ⚠️ **Open.** Reachable in the shipped bundle via deep-link parsing (`gymapp://`). `npm audit fix` cannot resolve it without breaking the SDK 57 alignment — it comes through Expo's own dependency tree. Impact is a local hang from a malicious link, not data exposure. Recheck when Expo bumps it. |
| `uuid` bounds check (GHSA-w5hq-g745-h8pq) | Low | Build-tooling only; verified **not** in the shipped bundle. |
| No rate limiting on username search | Low | `rpc_search_users` allows enumeration at 20 results/query. Mitigated by 3-char minimum and opt-in discoverability. Consider Supabase rate limits. |
| No server-side content filter on usernames | Low | A user can set an offensive handle; it is reportable but not pre-screened. Apple accepts report-based moderation, but a profanity check on save would be cheap. |

**Breach exposure if Supabase were compromised:** email addresses, hashed passwords,
and all training/bodyweight data. No payment data, no government IDs, no location, no
photos. Under most state breach-notification laws, email + hashed password may trigger
notification duties — you should have an incident plan before launch (see
`legal/INCIDENT_RESPONSE.md`).

---

## 9. MARKETING CLAIMS

Reviewed all user-facing strings. No unsupported claims about weight loss, health
outcomes, guaranteed results, or earnings. The one area needing care:

- The recommender says "Based on N recent sets" and gives a rationale — factual, fine.
- Trophy names ("Legend", "Cross-Trainer") are motivational, not claims.
- ✅ Added an explicit "logging tool, not medical or fitness advice" line to the profile
  and Terms §1.

**Do not** add marketing copy claiming the app prevents injury, guarantees strength
gains, or provides medical/training advice.

---

## 10. PRIORITISED ACTIONS

### CRITICAL — before submission
1. Fill the five placeholders in `src/legal/config.ts`.
2. Host the Privacy Policy at a public URL; add it to both store listings.
3. Choose a distinctive app name and bundle ID (cannot be changed later).
4. Set up and monitor the support email.
5. Re-enable email confirmation in Supabase Auth.
6. If you already have real users, reset the email-derived usernames (§3).

### HIGH — strongly recommended before launch
7. Attorney review of the injury disclaimer and the Washington MHMDA question.
8. Complete Apple privacy labels and Google Play Data Safety accurately.
9. Add the web-based account-deletion URL Google Play requires.
10. Define how you will review reports and act within the 24 hours the Terms promise.
11. Write the incident-response plan.

### MEDIUM
12. Track the `decode-uri-component` advisory; update when Expo does.
13. Add a profanity filter on username save.
14. Consider rate-limiting user search.
15. Decide whether to retain abuse reports past account deletion.

### LOW
16. Add a "what's changed" prompt when the Terms version bumps.
17. Consider making friend stats more granular (per-stat visibility toggles).

---

## 11. WHAT I COULD NOT DECIDE FOR YOU

These need a business or legal decision, not a code change:

1. **Your legal entity** — sole proprietor under your own name, or an LLC? An LLC gives
   liability separation that matters for an app giving lifting suggestions.
2. **Governing-law state** — normally where you live or where the entity is formed.
3. **Whether MHMDA applies** — needs an attorney.
4. **Whether to add arbitration** — needs an attorney.
5. **The app's real name** — a branding decision with trademark consequences.
