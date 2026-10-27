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

From 1.1 (changeable only with a new version):

```
Know what to lift, track runs
```

`29 characters`. It keeps the main selling point and adds running. Other
options: `Lifting log with GPS running` (28). 1.0 used
`Know what weight to lift next` (29).

## Promotional text (170 max — editable later without review)

From 1.1:

```
New: GPS running. Record runs with your screen locked, see your pace and rest timer on the Lock Screen, and share a card after every workout or run.
```

`148 characters`. 1.0 used: "Log a set with reps and how hard it felt. Rust
Strength estimates your one-rep max and tells you what to load next, rounded
to what the machine can actually be set to." (166)

## Keywords (100 max, comma-separated, no spaces)

From 1.1:

```
workout,gym,lifting,tracker,running,gps,pace,rpe,1rm,steps,cardio,5k,barbell,log,progress,pr,rest
```

`97 characters`

Words already in the Name and Subtitle are indexed automatically, so
"strength", "lift", "track" and "runs" are left out to avoid wasting space.
1.0 used `workout,gym,lifting,tracker,rpe,1rm,barbell,dumbbell,log,progress,routine,split,volume,pr,rest`.

## Description (4000 max)

From 1.1:

```
Rust Strength answers the question every lifter has mid-workout: how much should I put on the bar for the next set? And now it records your runs too.

Log a set with the weight, the reps, and how hard it felt on the RPE scale. Rust Strength estimates your one-rep max from that, then suggests a weight for your next set aimed at reaching failure inside the rep range you chose. Every suggestion is rounded to a weight the machine in front of you can actually be set to, and each machine keeps its own history, so a hotel gym doesn't throw off what it knows about your home gym.

LIFTING

Weight suggestions after every set, with a plain-English reason for each one.
Every set from last time shown while you log, top set in bold.
Over 200 exercises built in, or add your own. Search forgives typos.
Bodyweight, assisted and timed exercises: more reps, less assistance, or a longer hold to beat.
Presets, and a generator that builds a session from the equipment you have and the muscles you haven't trained this week.
A rest timer that starts when you save a set, counting down on your Lock Screen and in the Dynamic Island with your next set.

RUNNING

Record runs with GPS, with your phone locked: live map, distance, pace, splits and steps.
Your time, distance and pace on the Lock Screen and in the Dynamic Island.
Auto-pause at lights, and optional spoken updates every mile or kilometre.
A summary for every run with pace and elevation charts. Edit the title or trim the start and end afterwards.
Weekly and monthly distance, a weekly goal, and your fastest mile, 5K, 10K, half marathon and marathon.
Save a route, run it again and compare your attempts.
Enter treadmill runs by hand.

PROGRESS AND FRIENDS

Streaks, consistency, volume, time trained and personal records. Every activity counts toward your streak, and planned rest days keep it alive.
A body chart of the muscle groups you trained this week, and a progress chart for every exercise.
Tiered trophies from Wood to Legend for lifts, running, steps and more, plus XP, levels and badges. Show two favourites next to your name.
A feed of friends' sessions and runs that you can react to, and a leaderboard for streaks, weight lifted, workout time, distance run and more.
Share a card after any workout or run, to Instagram, Messages or Photos.
Track 40+ other activities, from pickleball to skiing.

DESIGNED TO ASK FOR LITTLE

No ads. No analytics. No tracking. Rust Strength asks for an email address and a password so your training syncs, and collects nothing it doesn't need. Location is used only for runs you record and privacy zones you set. Friends see a summary of a session, never the individual sets, and a run's map only if you share it, with the start and end always hidden. Steps are shared only if you turn that on. Export everything you've logged, or delete your account and all its data, from inside the app at any time.

IMPORTANT

Rust Strength is a training log, not medical or professional coaching advice. It suggests weights from the numbers you give it and knows nothing about your health, injuries or experience. Warm up, use your own judgement, and stop if something hurts. Be aware of your surroundings when you run. Talk to a doctor before starting a new training programme.

Privacy Policy: https://lindellrhett-gif.github.io/rust-strength/privacy.html
Terms of Service: https://lindellrhett-gif.github.io/rust-strength/terms.html
```

`3,424 characters of 4,000`

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
view each other's profiles, a feed of each other's finished sessions and a
leaderboard of their totals, and can react to a post from a fixed set of four
reactions. There is no free-text
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

Running (version 1.1): Today > Start run records a run with GPS. Location is
requested "When In Use" only when the user taps Start (or places a privacy
zone at their location), and is used only between Start and Save. The location background mode keeps the run recording
with the screen locked, and the blue location indicator shows while it does.
The audio background mode is used only to speak distance and pace updates
during a run with the screen locked, which the user can turn off in Running
settings. While a run records, a Live Activity shows its time, distance and
pace on the Lock Screen and in the Dynamic Island; it is started and updated
by the app on the device (no push notifications) and ends when the run is
saved or discarded. The rest timer between sets is shown the same way, with
the next set, while it runs. Motion & Fitness is requested to count steps;
daily step totals leave the device only if the user turns on "Share daily
steps" (Profile, off by default), for a friends-only steps leaderboard. A run can also be
entered by hand with no location. Friends see a run's map only if the user
turns it on for that run, and the server trims its start and end first.
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
| Health & Fitness | **Fitness** | Workouts, sets, weights, reps, RPE, activities, runs, steps, distance, calories |
| Health & Fitness | **Health** | Bodyweight, which is optional but user-provided health data |
| User Content | **Other User Content** | Usernames, display names, exercise, machine, preset and activity names, reactions, and reports filed about other users |
| Identifiers | **User ID** | The account ID and username |
| Location | **Precise Location** | The route of a recorded run, and privacy zones (from version 1.1) |

For **every one** of the six, answer:

| Question | Answer |
|---|---|
| Purposes | **App Functionality** only |
| Linked to the user's identity? | **Yes** — it is stored against their account |
| Used for tracking? | **No** |

Leave everything else unticked. The ones most likely to tempt a wrong answer:

- **Name:** no. The app never asks for a real name. Usernames and display names
  are covered by User ID and Other User Content.
- **Device ID:** no. No push token or advertising identifier is ever created.
- **Coarse Location:** no. Supabase's server logs record IP addresses for
  security, but the app does not derive or use location from them. Precise
  Location covers the runs.
- **Crash Data, Performance Data, Other Diagnostic Data:** no. There is no crash
  reporting or analytics SDK.
- **Product Interaction, Other Usage Data:** no. Nothing records how the app is
  used.
- **Customer Support:** no. Support is by email outside the app, not collected
  in it.
- **Search History:** no. A friend search is sent to the database to look up a
  username and is not saved there.

**Privacy Policy URL:** `https://lindellrhett-gif.github.io/rust-strength/privacy.html`

If the app ever adds analytics, crash reporting, advertising, or real push
notifications, or uses location for anything beyond recording runs, this
section, the manifest and the policy all change together.

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
