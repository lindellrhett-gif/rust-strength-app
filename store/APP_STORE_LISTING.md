# App Store listing — Rust Strength

Copy these fields into App Store Connect. Character limits are Apple's and are
counted below, so nothing here needs trimming.

> **Claims discipline.** Nothing in this copy promises strength gains, weight
> loss, injury prevention or any health outcome. The app suggests training
> weights from numbers the user enters; it does not know their health. Keep it
> that way — unsupported fitness or health claims are both an App Review
> problem and an FTC advertising problem.

---

## Name (30 max)

```
Rust Strength
```

`13 characters`

## Subtitle (30 max)

```
Know what weight to lift next
```

`29 characters`

## Promotional text (170 max — editable later without review)

```
Log a set with reps and how hard it felt. Rust Strength estimates your one-rep max and tells you what to load next, rounded to what the machine can actually be set to.
```

`166 characters`

## Keywords (100 max, comma-separated, no spaces)

```
workout,gym,lifting,tracker,rpe,1rm,barbell,dumbbell,log,progress,routine,split,volume,pr,rest
```

`94 characters`

Words already in the Name and Subtitle are indexed automatically, so
"strength", "weight" and "next" are deliberately left out to avoid wasting
space.

## Description (4000 max)

```
Rust Strength answers the question every lifter has mid-workout: how much should I put on the bar for the next set?

Log a set with the weight, the reps, and how hard it felt on the RPE scale. Rust Strength works out an estimated one-rep max from that, then suggests a weight for your next set aimed at reaching failure inside the rep range you chose. Every suggestion is rounded to a weight the machine in front of you can actually be set to, because a recommendation of 147 lb is useless on a stack that moves in tens.

BUILT FOR TRAINING IN DIFFERENT GYMS

Machines are not consistent. A chest press at one gym does not feel like a chest press at another, and plate-loaded, selectorised and cable setups all label weight differently. Rust Strength records which machine each set was performed on and rounds to that machine's own increment, so a session in a hotel gym does not corrupt what it knows about your home gym.

WHAT YOU GET

Autoregulated weight suggestions after every set, with a plain-English reason for each one.
Estimated one-rep max per exercise, updated as you train.
Over 200 exercises built in, or add your own.
Bodyweight exercises suggest more reps, with optional added weight. Assisted pull-ups and dips suggest less assistance as you get stronger.
Sets grouped by exercise, so five sets of bench read as one block.
Workout presets — save "Push Day 1" once and start it pre-loaded with every exercise.
A workout generator that builds a session from the equipment you actually have, prioritising the muscles you have not trained this week.
A live workout timer, plus totals for time, volume, reps and sets.
Activity tracking for runs, cardio machines, classes and more than 40 sports and activities from pickleball to skiing, timed live or entered by hand.
A calendar for planning sessions ahead, logging rest days, and reviewing what you have done.
A body chart showing which muscle groups you have and have not trained this week.
A rest timer between sets, set to whatever length you want, that starts on its own when you save a set and can alert you when rest is over, even with your phone locked.
Tiered trophies across nine ranks, from Wood to Legend, for the main lifts, calisthenics, and lifetime weight moved.
XP and levels earned from the training you log, unlocking badges as you climb.
A feed of your friends' recent sessions that you can react to, and profiles showing their streaks, levels and progress.

DESIGNED TO ASK FOR LITTLE

No ads. No analytics. No tracking. No third-party advertising SDKs. Rust Strength asks for an email address and a password so your training syncs to your devices, and collects nothing it does not need to run. Your bodyweight is optional. Friends see a summary of a session, never the individual sets, and you can switch feed sharing off entirely. You can export everything you have logged, and delete your account and all its data from inside the app at any time.

IMPORTANT

Rust Strength is a training log, not medical or professional coaching advice. It suggests weights from the numbers you give it and knows nothing about your health, injuries, or experience. Warm up, use your own judgement, and stop if something hurts. Talk to a doctor before starting a new training programme.

Privacy Policy: https://lindellrhett-gif.github.io/rust-strength/privacy.html
Terms of Service: https://lindellrhett-gif.github.io/rust-strength/terms.html
```

`3,412 characters of 4,000`

## URLs

| Field | Value |
| --- | --- |
| Support URL (required) | `https://lindellrhett-gif.github.io/rust-strength/support.html` |
| Marketing URL (optional) | `https://lindellrhett-gif.github.io/rust-strength/` |
| Privacy Policy URL (required) | `https://lindellrhett-gif.github.io/rust-strength/privacy.html` |

## Category

- **Primary:** Health & Fitness
- **Secondary:** Sports

## Age rating

Expect **13+**. The questionnaire will ask whether the app has user-generated
content or social features — answer **yes** to both. Friends see each other's
profiles and a feed of each other's sessions, and usernames, display names,
custom exercise names, preset names and activity names are all free text
written by users, shown to friends.

There is no free-text commenting. Reactions are a fixed set of four, so the
only user-written text that reaches another person is the names above.

Do not be tempted to answer "no" to get a 4+ rating. Misrepresenting
user-generated content is a rejection, and a removal risk after launch.

## App Review notes

Paste this into "Notes" so the reviewer is not stuck at the sign-up screen:

```
Rust Strength is a workout tracker. It requires an account so training data
syncs across devices.

A demo account is provided below. It has workout history, presets and trophies
already populated so the features are visible without logging a session.

Sign-up is email and password only. There is no paid content, no subscription
and no advertising in this build.

User-generated content: users choose a username and display name, and may name
their own exercises, machines, presets and activities. Accepted friends can
view each other's profiles and a feed of each other's finished sessions, and
can react to a post from a fixed set of four reactions. There is no free-text
commenting or messaging anywhere in the app.

Reporting and blocking are available from any user's profile (Friends tab >
Friends > open a profile > Report). A user can stop appearing in the feed at
Profile > Sharing with friends. Account deletion is at
Profile > Privacy & legal > Delete my account.

Levels and badges are worked out from the user's own logged training. The
Influencer and Beta Tester badges are awarded by the developer and cannot be
obtained in the app; there is nothing to purchase anywhere in this build.

Notifications: the app never asks for notification permission on launch. It
asks only if the user turns on Profile > Rest timer > "Alert when rest is over".
That alert is a local notification scheduled on the device for when the rest
timer ends. The app does not use push notifications and never requests a push
token.

Password reset: "Forgot password?" on the sign-in screen emails a one-time
code, which the user enters in the app with a new password.
```

Create the demo account before submitting and put its credentials in the
"Sign-in required" fields. A reviewer who cannot get in will reject the build.

## App Privacy (the "nutrition label")

App Store Connect → your app → **App Privacy** → **Get Started**. These answers
must agree with the privacy policy and with the privacy manifest in `app.json`.
Apple compares the manifest against this questionnaire, and a mismatch between
the label and what the app does is grounds for removal.

**Do you or your third-party partners collect data from this app?** Yes.

Select exactly these data types, and nothing else:

| Category | Data type | What it is in Rust Strength |
|---|---|---|
| Contact Info | **Email Address** | Sign-in, and password reset codes |
| Health & Fitness | **Fitness** | Workouts, sets, weights, reps, RPE, activities, steps, distance, calories |
| Health & Fitness | **Health** | Bodyweight, which is optional but user-provided health data |
| User Content | **Other User Content** | Usernames, display names, exercise, machine, preset and activity names, reactions, and reports filed about other users |
| Identifiers | **User ID** | The account ID and username |

For **every one** of the five, answer:

| Question | Answer |
|---|---|
| Purposes | **App Functionality** only |
| Linked to the user's identity? | **Yes** — it is stored against their account |
| Used for tracking? | **No** |

Leave everything else unticked. The ones most likely to tempt a wrong answer:

- **Name:** no. The app never asks for a real name. Usernames and display names
  are covered by User ID and Other User Content.
- **Device ID:** no. No push token or advertising identifier is ever created.
- **Coarse / Precise Location:** no. Supabase's server logs record IP addresses
  for security, but the app does not derive or use location from them.
- **Crash Data, Performance Data, Other Diagnostic Data:** no. There is no crash
  reporting or analytics SDK.
- **Product Interaction, Other Usage Data:** no. Nothing records how the app is
  used.
- **Customer Support:** no. Support is by email outside the app, not collected
  in it.
- **Search History:** no. A friend search is sent to the database to look up a
  username and is not saved there.

**Privacy Policy URL:** `https://lindellrhett-gif.github.io/rust-strength/privacy.html`

If the app ever adds analytics, crash reporting, advertising, location, or real
push notifications, this section, the manifest and the policy all change
together.

## Screenshots

Required: **iPhone 6.9" display**, 1290 × 2796 or 1320 × 2868 px, up to 10.
Since iPad support is turned off, no iPad screenshots are needed.

The iPhone 16 Pro shoots 1206 × 2622, which is a 6.3" display and is refused at
upload. `npm run screenshots` resizes them — see `store/screenshots/README.md`
for the whole routine, including what to check before you shoot.

Suggested order — lead with the thing no other tracker does:

1. **Add-set screen showing the suggestion card.** The whole pitch in one
   image. Caption: "Know what to lift next."
2. **Active workout with sets grouped by exercise** and the Up Next banner.
   Caption: "Every set in its place."
3. **Post-workout summary showing a personal record.** Caption: "See what you
   beat."
4. **Home screen with the body chart.** Caption: "Never skip a muscle group."
5. **Trophy shelf and level card.** Caption: "Nine ranks. Wood to Legend."
6. **Friend feed with reactions.** Caption: "See what your friends are lifting."

Log a few real sessions on the demo account first so nothing shows an empty
state. Empty screenshots convert badly and look unfinished to a reviewer.
