# UK Online Safety Act: risk assessments

Bluestem Software LLC's assessments of Rust Strength under the Online Safety
Act 2023:

1. the illegal content risk assessment (s 9);
2. the children's access assessment (ss 35 to 37);
3. the children's risk assessment (s 11).

Written November 7, 2026, for app version 1.2 (branch `feature/nutrition`,
migrations up to `0031`) and the legal documents at version 1.6.0.
**Not reviewed by a lawyer.** Ofcom and the courts decide how the Act applies,
not us. This file records our reasoning in good faith. It does not say the app
meets the Act.

**Status since this was written (November 7, 2026, later the same day).** The body
below describes the code as first found. Since then:

- **The three database problems are fixed in code, but not yet live.** They are
  forced or self-accepted friendships, requests across a block, and whole profile
  rows readable by friends and requesters. The fixes are migrations
  `0032_friendship_integrity.sql`, `0033_profile_names.sql` and
  `0034_profiles_owner_only.sql` (release day). They are tested in
  `supabase/tests/friendship-integrity.test.mjs`. Each needs the owner's OK to apply
  to the live database. The grooming and harassment ratings assume they are applied
  before the UK storefront goes on.
- **Terms section 4** now prohibits:
  - encouraging suicide, self-harm or eating disorders;
  - threats, terrorism and violent extremism;
  - offering or promoting illegal drugs, controlled substances (including anabolic
    steroids) or weapons.
- **Terms section 6** now covers complaints about how reports and content are
  handled, and about the Act's duties. Both changes are in English and French.
- **`legal/MODERATION.md`** now has:
  - reports from anyone;
  - the statement-of-reasons email;
  - threats to life;
  - complaints, answered within 14 days;
  - a moderation log kept outside the database.
- **The sharing question** has two equal buttons, "Keep private" and "Share".
- **Still open:**
  - Report and Block on incoming requests and search results;
  - eating disorder support links;
  - whether to name the accountable person;
  - the other actions below not listed here.

**Reassess** at least once a year, before any of the changes in section 9, and
after any serious incident.

**What could not be checked.** Ofcom's website refused automated requests
(HTTP 403) on November 7, 2026, so its guidance was not re-read for this
version. The method and lists below follow, as we understand them, Ofcom's Risk
Assessment Guidance and Risk Profiles (December 2024), its Children's Access
Assessments Guidance and Children's Risk Assessment Guidance (April 2025), and
its codes of practice, plus later changes reported by the sources at the end.
Points that rest on text we could not read are marked **not checked**.

## Summary

| Question | Answer |
|---|---|
| Does the Act apply? | Yes, once the app is offered in the UK. It is a user-to-user service, and the UK becomes a target market. |
| Illegal content risk | **Low.** No kind of illegal harm is above low; most are negligible. |
| Which Ofcom measures apply | Small (far below 7 million monthly UK users) and low risk. The measures Ofcom recommends for every service apply; the ones for large or higher-risk services don't. |
| Likely to be accessed by children? | **Yes, treated as likely.** The UK minimum age is 13, and there is no highly effective age assurance. |
| Risk to children | **Low** for every kind of content harmful to children, including eating disorders. |
| Condition | The ratings depend on fixing database gaps that let a signed-in person become someone's "friend" without their agreement, keep sending requests after being blocked, and read a friend's bodyweight (section 2.4). Until the first two are fixed, grooming and harassment would be **medium**. Fix all three before the UK storefront is turned on. |

## 1. Does the Act apply?

- **User-to-user service (s 3).** Content one user writes can be seen by
  another: usernames and display names in search and friend requests, and the
  names of workouts, activities and exercises on friends' profiles and feeds.
- **Links with the UK (s 4).** Once the UK storefront is on in App Store
  Connect, the UK is a target market. Until then the app isn't offered there.
- **No exemption fits.** The "limited functionality" exemption (Schedule 1,
  paragraph 4) covers services where users can only comment on or review the
  provider's own content and react to it. Here users see what other users wrote
  about their own training. We don't rely on any exemption.
- **Uncertain:** whether a session summary the app builds from someone's logged
  training is user-generated content (s 55). It doesn't change the answer,
  because the names in it are typed by users.
- **No category.** The app is far below the user numbers for Category 1, 2A or
  2B, so the extra duties for categorised services don't apply.

## 2. How the service works

The assessment rests on this. Checked in the code on November 7, 2026.

### 2.1 What other people can see

| Who | What they see | Code |
|---|---|---|
| Anyone signed in | The username and display name of accounts that chose their own handle, by typing the start of the username (3 characters or more, 20 results at most, blocks excluded both ways). Nothing else. | `rpc_search_users` (0007) |
| Either side of a friend request | The other person's username (and display name). | `app/(tabs)/friends.tsx` |
| Accepted friends | Totals, streaks, consistency, workout dates, personal bests per exercise, trophies, level and the friends-only leaderboard. If the person shares: a feed of session summaries (name, time, length, volume, sets, reps, exercise names, record count; for runs, distance, time and pace, and a trimmed map only if chosen for that run). Reaction counts, not who reacted. | `rpc_friend_stats`, `rpc_friend_prs`, `rpc_friend_leaderboard`, `rpc_friend_feed` (0024) |
| Nobody else | The food diary, weigh-ins, nutrition goals, birth year, single sets, notes, rest days, privacy zones, saved routes and full routes. | Owner-only row-level security; `supabase/tests/nutrition.test.mjs` |

Section 2.4 lists where the database allows more than this.

### 2.2 Text users write that others can see

- **Usernames.** Random (`lifter_7f3a91`) until the person chooses one. The app
  allows letters, numbers and underscores, 3 to 20 characters
  (`app/(tabs)/profile.tsx`).
- **Display names.** Shown in search, the friends list, the feed and the
  leaderboard when set. The 1.2 app has no screen to set one, but the column
  can be written through the API (`profiles_update_own`, 0001).
- **Names of workouts, activities, runs and custom exercises.** A workout
  started from a preset takes the preset's name (0006).
- **Gym and machine names.** The moderation helper `rpc_admin_user_text` lists
  them and `legal/MODERATION.md` treats them as visible. We found no
  friend-facing function that returns them.
- The app shows all of these as plain text, not links.
- Only the app limits these names. The database doesn't limit the length or
  characters of usernames, display names, or workout, preset or exercise names.

### 2.3 How people interact

- **Friend requests.** Anyone signed in can send one to an account they found
  in search. The other person accepts or declines. Declining deletes the
  request, so the sender can send another. There is no limit on requests.
- **Remove friend, block, report.** Blocking removes the friendship both ways
  and hides both people from each other's search and feed (`rpc_block_user`,
  0007). Nobody is notified of a removal or a block.
- **Report and Block are only on an accepted friend's profile**
  (`app/friend/[id].tsx`), not on an incoming request or a search result.
  Anyone can also report by email (Terms section 6).
- **Reactions.** Four fixed ones (fire, strong, heavy, respect), one per person
  per post. The author sees counts only (0008, 0009).
- **Not present:** direct or group messages, comments, uploaded photos, videos,
  audio or files, livestreaming, public profiles or posts, follower counts,
  recommended people or content, an endless feed (it loads one page of 30
  posts), reposting, links, groups, a marketplace, advertising.
- **Share cards** are images made on the phone and sent outside the app through
  the share sheet (`src/lib/shareImage.ts`). Nothing is uploaded, and other
  users never see them in Rust Strength.

### 2.4 Gaps in the database

Found by reading the migrations, then confirmed by running the project's
migrations in its local test database (PGlite, `supabase/tests/harness.mjs`)
on November 7, 2026. The live Supabase project was not checked. None is fixed
here.

1. **A signed-in person can make themselves anyone's accepted friend.** The
   insert policy `friendships_insert` (0002) checks only that you are the
   requester, not the status, so a request can be created as already
   `accepted`. The update policy `friendships_update` also lets the requester,
   not only the addressee, set `accepted`. Someone using the API with their own
   sign-in can then see that person's stats, personal bests, workout dates and,
   if they share, feed and trimmed run maps. They need only the person's
   account id, which search returns for any account with a chosen handle.
2. **Blocking doesn't stop new requests.** Nothing checks `user_blocks` when a
   request is created. Someone who was blocked can send a new request through
   the API, and the person who blocked them sees it. The comment in 0007 says
   blocked users cannot send requests.
3. **The whole profile row is readable by friends and by either side of a
   pending request**, including `body_weight` (the latest weigh-in). Recorded
   as R2 in `legal/RECORDS_OF_PROCESSING.md`. A friend can also work out
   bodyweight from personal bests on bodyweight exercises (R3 there).
4. **Reports disappear with either account.** `user_reports` rows are deleted
   when the reporter's or the reported person's account is deleted
   (`on delete cascade`, 0007), with the moderator's notes (R15 there).

Gaps 1 and 2 undermine the control this assessment leans on most: only people
you accept can see anything about you. See actions 1 and 2 in section 7.

### 2.5 Risk factors from Ofcom's user-to-user risk profile

| Risk factor | Present? | Notes |
|---|---|---|
| Social media service | Partly | A fitness tracker with a friends feature, not a social network. Treated as present, to be safe. |
| User profiles | Yes | A friend's profile shows their training figures. |
| Accounts without identity checks | Yes | An email address is enough. Handles are pseudonymous. The Terms allow one account per person; nothing enforces it. |
| User connections | Yes | Friending, which both people must agree to (but see 2.4). |
| User search | Yes | By the start of a username. |
| Reactions | Yes | Four fixed reactions, counts only. **Not checked** whether Ofcom's current profile lists reactions as a factor. |
| Sharing location | Limited | A trimmed run outline, friends only, off by default for every run. The server drops the first and last 200 m and any start or end inside a privacy zone (`run_shared_route`, 0021). |
| Child users | Yes | 13 and over. |
| Low capacity | Yes | One person runs the company and does all the moderation. |
| Direct or group messaging, commenting, images or video, livestreaming, reposting, links, user groups | No | |
| Content recommender, people-you-may-know prompts | No | |
| Goods for sale, file sharing, dating, gaming, adult content, advertising | No | |

Ofcom's June 2026 update added risk factors for suicide and self-harm tied to
direct messaging, group messaging and recommender systems. The app has none of
them.

## 3. Illegal content risk assessment

### Step 1: understand the harms

**Kinds of harm.** Ofcom's 17 kinds of priority illegal content, as changed in
June 2026: after the Online Safety Act 2023 (Priority Offences) (Amendment)
Regulations 2025, Ofcom's statement of June 25, 2026 combined encouraging or
assisting suicide with encouraging or assisting serious self-harm into one
kind, "suicide and self-harm", and made cyberflashing a kind of its own. That
makes 18 kinds, assessed below, plus other illegal content. Reported by
secondary sources; **not checked** against Ofcom's own pages.

**Evidence used** (Ofcom's "core inputs"):
- the risk profile (section 2.5);
- the app's code and database (sections 2.1 to 2.4);
- reports received: the moderation queue (`v_open_reports`). The app hasn't
  been offered in the UK, so there are no UK reports to draw on. The number of
  reports to date is not recorded here (action 11);
- the Terms and the moderation runbook.

No enhanced inputs (user research, outside review, testing by others). Ofcom
expects those mainly from large or higher-risk services.

### Step 2: assess the risk

| Level | Used when |
|---|---|
| Negligible | There is no realistic route on this service, usually because the harm needs images, video, messages, links or reach to strangers. |
| Low | Possible only through short text (a username or a name) seen by accepted friends or in username search. Little reach; can be reported and removed. |
| Medium, high | Not given to any kind. |

| # | Kind of illegal harm | Risk | Why |
|---|---|---|---|
| 1 | Terrorism | Low | A name could praise a proscribed group. No video, links, groups or reach; friends or searchers only. |
| 2a | Child sexual exploitation and abuse: grooming | Low\* | Adults can find a child's username and send a request, and a username can carry an off-app contact ("add me on..."). No messaging, so no way to talk inside the app, and the child must accept. Severe impact, low likelihood. |
| 2b | Child sexual exploitation and abuse: abuse material | Low | No images, video or uploads, so none can be stored or shown. The only route is text, such as a web address typed into a name, which is not a link and is seen by friends only. |
| 3 | Hate | Low | Offensive usernames are the most likely abuse here. Seen in search and by friends. "Offensive username or name" is a report reason. |
| 4 | Harassment, stalking, threats and abuse | Low\* | Repeated requests after a decline, abusive names, and friends seeing when someone trains and, if shared, a trimmed run outline. Block, remove friend, sharing off by default, maps off by default. |
| 5 | Controlling or coercive behaviour | Low | A partner could press someone to accept a request and use the feed to watch their routine. Sharing and maps start off; removing a friend notifies no one. |
| 6 | Intimate image abuse | Negligible | No images or video. |
| 7 | Extreme pornography | Negligible | No images or video. |
| 8 | Sexual exploitation of adults | Negligible | No posts to strangers, messages, links or listings to advertise with. |
| 9 | Human trafficking | Negligible | No way to advertise or recruit: no public posts, messages or listings. |
| 10 | Unlawful immigration | Negligible | As 9. |
| 11 | Fraud and financial offences | Low | A username could pose as the app's support. No messages, links or payments between users to make a scam work. |
| 12 | Proceeds of crime | Negligible | No payments between users, no marketplace, no messages to recruit money mules. |
| 13 | Drugs and psychoactive substances | Low | Gym culture includes steroids, which are Class C. A username or name could offer them. Text only, friends or searchers only, no messages to arrange a sale. |
| 14 | Firearms, knives and other weapons | Negligible | No marketplace, images or messages. |
| 15 | Suicide and self-harm | Low | A name could encourage it. No messages, groups, comments or recommendations, the features Ofcom links to this harm. |
| 16 | Foreign interference | Negligible | No public posts, reach, amplification or advertising. |
| 17 | Animal cruelty | Negligible | No images or video. |
| 18 | Cyberflashing | Negligible | Needs an image or video sent to someone. The app can't send or show one. |
| - | Other illegal content | Low | Threatening or false communications (ss 179 and 181) through names. Flashing images (s 183) are impossible without images. Intellectual property offences are outside the Act's illegal content (s 59); copyright notices go through Terms section 7. |

\* **Only once gaps 1 and 2 (section 2.4) are fixed.** Until then anyone with
some technical skill can become a "friend" of any searchable account without
being accepted, and a blocked person can keep sending requests. That would put
grooming and harassment, stalking, threats and abuse at **medium**. With two
kinds at medium the service would be "multi-risk" in Ofcom's codes, and more
measures would apply.

**Result:** with the gaps fixed, a **low-risk** service. Every kind is low or
negligible.

### Step 3: decide and put measures in place

Section 6 lists what is in place, section 7 what is not yet.

### Step 4: report, review and update

Sections 8 (records) and 9 (review). The accountable person approves this file
(end of section 9).

## 4. Children's access assessment

### Stage 1: is it possible for children to use the service?

**Yes.** The UK minimum age is 13 (`src/domain/age.ts`), so 13 to 17 year olds
may use it by design. The age check is a self-declared checkbox ("I am at
least 13 years old") at sign-up and on the consent screen. The phone's region,
which picks 13 or 16, is self-declared too (`src/lib/deviceRegion.ts`).
Ofcom's guidance says a service can answer "no" here only if highly effective
age assurance keeps children out. A checkbox isn't that.

### Stage 2: the child user condition

The condition is met if a significant number of children use the service, or
it is likely to attract a significant number. Ofcom's guidance says a
"significant" number can be small, in absolute terms or as a share of users.

| Evidence | What it shows |
|---|---|
| UK users | None yet; the app hasn't been offered in the UK. |
| Ages of users | Not known. The app stores no date of birth, only that the age box was ticked, and a birth year if the calorie goal calculator is used. |
| What the app offers | Strength training, running, steps, trophies, levels, streaks and a friends leaderboard. Many teenagers train and run, and game-like features appeal to them. |
| How it is presented | Nothing in the app or store listing is aimed at children, and nothing keeps them away. Expected App Store rating 13+ (`store/APP_STORE_LISTING.md`). |

**Not proven either way.** There is no data showing many children use it, and
none showing few do. We treat the child user condition as met.

### Conclusion

Rust Strength is treated as **likely to be accessed by children** in the UK.
So the children's risk assessment (section 5) and the duties to protect
children apply. This changes only if the app adopted highly effective age
assurance with an 18+ minimum, which is not planned, or if real evidence showed
the condition is not met.

## 5. Children's risk assessment

Same four steps as section 3. Children here are 13 to 17. Ofcom asks for risk
by age group; 13 to 15 year olds are the more vulnerable group here, and the
app treats both groups the same except for weight-loss goals (under 18).

Risk levels mean the same as in section 3, step 2.

| Kind of content harmful to children | Risk | Why |
|---|---|---|
| **Primary priority content** | | |
| Pornography | Negligible | No images, video or links. Sexual text in a name is against Terms section 4 and is removed when reported. |
| Suicide | Low | Text in a name only. No messages, groups, comments or recommendations. |
| Self-harm | Low | As suicide. |
| Eating disorders | Low | No food diary content reaches anyone, and there are no photos. The app's own design matters more than other users' content; see 5.1. |
| **Priority content** | | |
| Abuse and hate | Low | Offensive names, seen in search and by friends. Report reason "Offensive username or name". |
| Bullying | Low | The most likely harm to children here: classmates as friends, mocking names, comparison on the leaderboard. Reactions are four positive ones, counts only; no comments. Remove friend and block. |
| Violent content | Low | Threats in a name. No images, so no depictions of violence. |
| Harmful substances | Low | Gym culture includes steroids and diet pills. A name could promote them. Friends only. |
| Dangerous stunts and challenges | Low | No video. A name could set a challenge. The app's own streaks and leaderboard aren't user content, but rest days keep a streak and the Terms say nothing is a reason to train through pain. |
| **Non-designated content** | | |
| Body stigma | Low | No photos. Bodyweight isn't shown to others in the app, but see gap 3 in section 2.4. Names could shame someone's body. |
| Depression | Low | No posts about how someone feels, and no content from strangers. A name is the only route. |
| Over-training and comparison pressure | Low | From the app's own features, not user content. Friends-only leaderboard, no notifications pulling people back, rest days count. |

Body stigma and depression content are the two kinds Ofcom named as
non-designated content in its Children's Register of Risks (April 2025). A
later Ofcom report recommended designating them. Whether that has happened was
**not checked**.

**Result:** **low** for every kind, on the same condition as section 3: gaps 1
to 3 in section 2.4 fixed before UK launch.

### 5.1 Eating disorders

Counting calories and logging weight can feed disordered eating, and
teenagers are at higher risk. The Act's children's duties are mainly about
content users come across, but Ofcom asks services to consider how their
design affects risk, so both are covered here.

**What the app does** (`src/domain/nutrition/goals.ts`,
`src/domain/nutrition/goalForm.ts`, `app/nutrition/goals.tsx`):

- **The food diary is private.** Every nutrition table is owner-only under
  row-level security; no friend function reads them (`supabase/tests/nutrition.test.mjs`).
- **No game or social element on food or weight.** No trophies, XP, streaks,
  badges, leaderboard figures or share cards come from the diary or weigh-ins
  (checked `src/domain/achievements.ts`, `badges.ts`, `xp.ts`,
  `leaderboard.ts`, `shareCard.ts`).
- **Weight-loss goals for adults only.** The goal screen always asks for a
  birth year, which must give an age of 13 to 120. Age is taken as the lower
  possible one (the birthday isn't known). Under 18:
  - "Lose" isn't offered;
  - the goal must come from the calculator, to maintain or gain; a number of
    their own is refused;
  - a goal weight below today's weight is refused;
  - the calculator itself sets a minor's weekly change to zero, as a backstop.
- **A rate cap.** At most 1 kg a week either way (choices 0.25 to 1 kg, or 0.5
  to 2 lb).
- **A warning floor.** Below 1,200 kcal a day (women, and anyone who leaves sex
  out) or 1,500 (men), the screen says "Check with a doctor or dietitian before
  eating this little" and asks again before saving. A warning, not a block.
- **A hard minimum.** No goal under 800 kcal a day is saved, from the
  calculator or typed in; if the calculator's rate would go under it, the form
  asks for a slower one. The most is 10,000.
- **Estimates, said plainly.** The result is labelled an estimate from the
  Mifflin-St Jeor equation. Terms section 1 says to talk to a doctor or
  registered dietitian first, especially after an eating disorder.
- **Paid.** The diary is part of Rust Strength Pro. That limits who has it, but
  it isn't a safeguard.

**What it doesn't do:**

- The birth year is typed by the person and can be changed to unlock adult
  goals.
- Logging food and weigh-ins has no age limit; only goals do.
- The rules run in the app only. The database accepts any goal from 0 to
  20,000 kcal (`nutrition_goals`, 0027).
- Nothing in the app points to eating disorder support.
- An adult can save a goal under the floor after the warning.
- Bodyweight can be read or worked out by friends through the API (gap 3).

**Rating:** low for content harmful to children, since no user content about
food or weight reaches anyone. The design risk for teenagers using a calorie
diary is a product decision, already open in `legal/LEGAL_AUDIT.md` (section
16, question 3) and rated medium as a data protection risk in
`legal/RECORDS_OF_PROCESSING.md` (R6). Options are in section 10.

## 6. Measures in place

Measure numbers are from Ofcom's codes as issued in 2025, as we understand
them. The 2026 consolidated codes may number them differently (**not checked**).

| Measure | What Rust Strength does | Where | Ofcom measure |
|---|---|---|---|
| Accountable person | Rhett Lindell, who owns and runs Bluestem Software LLC, is accountable for the illegal content and children's safety duties and the reporting and complaints duties. | This file | ICU A2, PCU A2 |
| Content moderation | A person reviews every report, once a day while the app is live. Actions: reset a name, ban, delete the account, or dismiss. Aim: act on abusive content within 24 hours. No automated moderation. | `legal/MODERATION.md`; Terms section 6 | ICU C1, C2; PCU C1, C2 |
| Reporting | Report on a friend's profile: five reasons (harassment or bullying, pretending to be someone else, offensive username or name, spam, something else) and up to 1,000 characters (`user_reports`, 0007). Anyone, with or without an account, can report illegal content by email, saying where it is and why. | `src/components/ReportUserModal.tsx`; Terms section 6 | Reporting and complaints measures for all services |
| Reasons and appeals | When we act, we tell the person what we did, the rule or law it was based on, and how to challenge it. Anyone who thinks we got it wrong can email, and a person reviews the decision. | Terms section 6 | Complaints and appeals measures |
| Terms of service | Section 4 (acceptable use) sets the rules; section 6 covers reporting, enforcement, reasons, appeals and the contact point. Plain English, with an equally valid French version. Linked on sign-up, the consent screen and Profile > Privacy & legal. | `src/legal/terms.ts`, `src/legal/fr/terms.ts` | ICU G1, G3; PCU G1, G3 |
| Block and remove friend | Block ends any friendship and hides both people from each other. Removing a friend is a long press. Neither notifies anyone. | `rpc_block_user` (0007) | Beyond what a small low-risk service is asked for |
| Private by default | Sharing sessions starts off for new accounts (0031), asked once at the first accepted friend (`src/domain/sharePrompt.ts`). Run maps off by default for each run. Daily steps off. Not searchable until a handle is chosen; handles start random. Routes trimmed on the server. Who reacted is hidden. The food diary is never shown. | Migrations 0007, 0009, 0021, 0024, 0030, 0031 | Beyond baseline |
| Few risky features | No messages, comments, images, public content, recommendations or endless feed. | Section 2.3 | |
| Age | 13+ in the UK, ticked at sign-up and on every re-consent. Accounts of under-13s are deleted when reported (Privacy Policy section 10). Weight-loss goals adults only. | `src/domain/age.ts`, `src/domain/nutrition/` | |
| Records | This file. Report rows with status, review time and the moderator's note (0010). | Section 8 | Record-keeping (s 23) |

## 7. Actions

Actions 1 to 4 close gaps the ratings depend on. Actions 5 to 9 are, as we
understand Ofcom's codes, what its measures for every service ask that isn't
fully in place yet. The rest reduce risk further.

**Before the UK storefront is turned on:**

1. **Close gap 1.** In a new migration: a request can only be created as
   `pending`; only the addressee can set `accepted`; the requester can only
   withdraw. Add a database test that a requester cannot create or set an
   accepted friendship.
2. **Close gap 2.** Refuse a request when either person has blocked the other.
   Test it.
3. **Close gap 3.** Let other people read only the profile columns the app
   shows (for example through a view or function returning username and
   display name), so `body_weight` and settings stay private. This is R2 in
   `legal/RECORDS_OF_PROCESSING.md`.
4. **Report and Block on an incoming request and in search results**, so
   nobody has to accept someone to report or block them.
5. **Terms section 4: name what isn't allowed.** Add content that encourages
   suicide, self-harm or eating disorders, offers drugs (steroids included) or
   weapons, threatens violence, or supports terrorism. Ofcom's age assurance
   measures are aimed at services that allow pornography, suicide, self-harm
   or eating disorder content; the Terms should say plainly that this one
   doesn't. Version 1.6.0 isn't published, so this can go into 1.6.0 without a
   version bump. Change the French Terms with it.
6. **Terms section 6: complaints about our duties.** Add that anyone can
   complain to us if they think we aren't meeting our duties under the UK
   Online Safety Act, including about protecting children, and how we handle
   it. Same note on 1.6.0 and the French.
7. **Moderation runbook (`legal/MODERATION.md`):**
   - deciding whether something is illegal, using Ofcom's Illegal Content
     Judgements Guidance;
   - order of work: risk to a child or to life first, then other illegal
     content, then the rest;
   - removing any account run by or for a proscribed organisation (ICU H1);
   - how to clear a single workout, preset or exercise name;
   - the statement of reasons: a short template and when to send it
     (`legal/RECORDS_OF_PROCESSING.md`, finding 8, notes this step is
     missing);
   - appeals: who reviews, and restoring content or an account if we were
     wrong;
   - child sexual exploitation: keep the evidence, don't copy or forward it,
     report to the NCA's CEOP (https://www.ceop.police.uk) for a child in the
     UK, and to NCMEC's CyberTipline (https://report.cybertip.org). US law
     (18 U.S.C. 2258A) may require a US provider to report to NCMEC; **not
     reviewed by a lawyer**;
   - a credible threat to someone's life: contact the police where they are;
   - a report suggesting someone may harm themselves: reply with support
     details (in the UK and Ireland, Samaritans, 116 123);
   - what happens when you can't check the queue for more than a day.
8. **A moderation log outside the database** (gap 4): date, report id, kind of
   harm, decision, rule or law, date acted, reasons sent, appeal and outcome.
   Account ids, not emails. Without it, deleting an account erases the record
   of what was decided.
9. **Complaints:** acknowledge every report and appeal sent by email, give a
   rough timeframe, and tell the person the outcome. Log each one (the log in
   action 8).

**Within three months of UK launch:**

10. **More report reasons:** "Illegal content" and "Someone may be at risk
    (including a child)", so they reach the top of the queue.
11. **Count things for the yearly review:** UK accounts, reports a month, time
    to act, appeals and their outcomes.
12. **Database limits on visible text:** usernames to the app's own rule (3 to
    20 letters, numbers and underscores), and a length limit on display names
    and on workout, preset, activity and exercise names. Decide whether display
    names stay (no screen sets them).
13. **Limit friend requests:** a daily cap per account, and a wait before
    asking again after a decline.
14. **Wording in Profile > Privacy & legal > Contact:** it mentions privacy
    questions only. Say it is also where to report a problem or illegal
    content and appeal a decision (`app/legal/privacy-center.tsx`).

**Good practice, not required at this risk level as we understand the codes:**

15. **Eating disorder support:** a line on the goal screen's floor warning and
    in the diary settings pointing to support, such as Beat in the UK.
16. **The food diary rules in the database:** the 800 kcal minimum, and no
    weight-loss goal when the saved birth year gives an age under 18.
17. **Watch Ofcom:** its statement on additional safety measures (expected
    autumn 2026; whether it is out was **not checked**), new priority offences
    from the Crime and Policing Act 2026, and any new code measure for small
    services. Ofcom has proposed, or may already have decided (**not
    checked**), extending blocking and muting to smaller services likely to be
    accessed by children that have profiles and connections. The app has
    blocking; it has no muting, which matters less without messages or
    comments.

## 8. Records

The Act (s 23) asks for a written record of every risk assessment, how it was
done and what it found, and of the measures taken.

- **This file is that record** for all three assessments. Each version stays in
  the repository's history. Keep a dated PDF of each version with the
  business's records as well, so it survives any change to the repository.
- **Keep superseded versions for at least five years.** Ofcom's draft
  record-keeping guidance suggested five; the final text was **not checked**.
- **Moderation:** report rows in `user_reports` (status, `reviewed_at`,
  `reviewer_note`), and the log in action 8.
- **If Ofcom asks**, send this file and the logs. Keep them in plain language
  so someone outside the business can follow them.

## 9. Review

**Next review: by November 7, 2027**, covering all three assessments.

**Review before**, not after, adding or changing any of:
- direct or group messages, or comments;
- photos, video, audio or file uploads, or livestreaming;
- public profiles or posts, or follower counts;
- recommending people or content, or "people you may know";
- links, groups, reposting, or an endless feed;
- who can see what: search by display name, wider leaderboards, showing
  bodyweight or the food diary to anyone;
- the minimum age, or the age check.

**Review after:**
- any serious incident: a report involving a child's safety, a credible threat,
  a cluster of reports about one account, or a breach of friend data;
- a change from Ofcom: risk profiles, codes, guidance, or new priority
  offences;
- a large rise in UK users, or evidence about how children use the app;
- fixing gaps 1 to 3: update section 2.4 and the ratings marked with a `*`.

| Date | Why | What changed | By |
|---|---|---|---|
| November 7, 2026 | First assessment, before the UK launch | All three assessments written | Rhett Lindell |

**Approved by the accountable person:** Rhett Lindell, ______________ (date).

## 10. Open questions

**For the owner:**

1. **Gaps 1 to 3** (section 2.4) must be fixed before the UK storefront goes
   on. They are database changes, outside this file.
2. **Being named.** This file names Rhett Lindell as the accountable person,
   while the public documents name the Privacy Officer by title only. Keep the
   name here, or use the title and record the name elsewhere.
3. **Teenagers and the calorie diary.** Keep it as it is; add support links
   (action 15); require a birth year before the diary opens and show under-18s
   no goal below maintenance; enforce the rules in the database (action 16);
   or make the diary 16+ or 18+.
4. **Search.** Offer a switch to not be findable by username. The app doesn't
   know who is a child, so a child-only default isn't possible today.
5. **Display names.** Keep the column (and moderate it) or drop it, since no
   screen sets it.
6. **How long to keep the moderation log** (action 8). Long enough to spot
   repeat offenders and show Ofcom what was done, against keeping personal
   data no longer than needed.
7. **Cover when you're away.** One person checks the queue. Decide what
   happens on days you can't.
8. **Accepting "likely to be accessed by children."** It is the honest answer
   with a checkbox age gate. The alternative, highly effective age assurance
   for everyone, would mean collecting more data from everyone.

**Uncertain law (for a lawyer, if one is asked):**

- Whether Ofcom's current guidance, risk profiles and codes still read as
  described here; Ofcom's site blocked our checks.
- Whether app-built session summaries are user-generated content (s 55).
- Whether Ofcom would expect any age assurance from a low-risk service whose
  Terms prohibit primary priority content (we think not).
- Whether s 66 (reporting child sexual exploitation and abuse content to the
  NCA) is in force; **not checked**.
- Whether the US reporting duty to NCMEC applies to this app.
- Whether body stigma and depression content have been designated by law.

## Sources

- Online Safety Act 2023: https://www.legislation.gov.uk/ukpga/2023/50.
  Schedule 1, paragraph 4 read on November 7, 2026:
  https://www.legislation.gov.uk/ukpga/2023/50/schedule/1/paragraph/4
- Ofcom, Risk Assessment Guidance and Risk Profiles (blocked, HTTP 403):
  https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/updates/risk-assessment-guidance-and-risk-profiles.pdf
- Ofcom, children's access assessments (not read; listed as updated June 29,
  2026):
  https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/childrens-access-assessment-duties-under-the-online-safety-act
- Ofcom, Statement: New priority offences, serious self-harm and cyberflashing
  (June 25, 2026; blocked):
  https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/statement-new-priority-offences-serious-self-harm-and-cyberflashing.
  Summary read: Mishcon de Reya, June 30, 2026,
  https://www.mishcon.com/news/new-priority-offences-under-the-online-safety-act-what-tech-companies-need-to-do-now
- Draft amendments to the Protection of Children Code for user-to-user
  services (June 18, 2026; read). They add crisis response measures for large
  or high-risk services only:
  https://www.gov.uk/government/publications/online-safety-act-draft-amendments-to-the-protection-of-children-code-of-practice-for-user-to-user-services/draft-amendments-to-the-protection-of-children-code-of-practice-for-user-to-user-services
- Ofcom, Children's Register of Risks (April 2025; not read):
  https://www.ofcom.org.uk/siteassets/resources/documents/consultations/category-1-10-weeks/statement-protecting-children-from-harms-online/main-document/childrens-register-of-risks.pdf
- Ofcom, Record-Keeping and Review Guidance (not read):
  https://www.ofcom.org.uk/siteassets/resources/documents/online-safety/information-for-industry/illegal-harms/updates/record-keeping-and-review-guidance.pdf
- In this repository: `src/legal/terms.ts`, `src/legal/privacy.ts`,
  `legal/MODERATION.md`, `legal/RECORDS_OF_PROCESSING.md`,
  `legal/LEGAL_AUDIT.md`, `supabase/migrations/`, `src/domain/`.
