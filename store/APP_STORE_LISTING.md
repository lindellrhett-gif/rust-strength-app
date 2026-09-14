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
Sets grouped by exercise, so five sets of bench read as one block.
Workout presets — save "Push Day 1" once and start it pre-loaded with every exercise.
A workout generator that builds a session from the equipment you actually have, prioritising the muscles you have not trained this week.
A live workout timer, plus totals for time, volume, reps and sets.
Activity tracking for runs, sports and cardio machines, timed live or entered by hand.
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

`~2,600 characters`

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
```

Create the demo account before submitting and put its credentials in the
"Sign-in required" fields. A reviewer who cannot get in will reject the build.

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
