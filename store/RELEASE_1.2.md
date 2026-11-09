# Releasing 1.2 (the food diary and Rust Strength Pro)

1.2 is the first version that sells something: the food diary is the paid
feature of Rust Strength Pro. So this checklist carries the subscription launch
in [SUBSCRIPTIONS.md](SUBSCRIPTIONS.md) as well as the food diary, on top of the
usual [build checks](BUILD_CHECKS.md). Work through it in order. The steps
marked **release day** wait until Apple has approved the build.

Nothing here has been reviewed by a lawyer.

## 0. Decisions only you can make

None of these can be settled from the code, and some block the rest:

- [x] **Prices and any free trial**, decided November 6, 2026: $9 a month,
  $55 a year and $99 for Lifetime (or the nearest App Store price points),
  with a one-month free trial on monthly and yearly (SUBSCRIPTIONS.md).
- [x] **Who sells it:** Bluestem Software LLC, decided November 6, 2026. The
  developer account is being converted from Individual to Organization; set
  up the Paid Applications Agreement, banking and tax once that is done.
- [x] **Consumer health data.** Decided November 6, 2026: release with the
  risk accepted, and reduce it where the code and documents can. Done: a
  separate Consumer Health Data Privacy Policy (`src/legal/healthData.ts`),
  linked on its own from the site's homepage and navigation, from Privacy &
  legal in the app, from the Privacy Policy, and from the App Store
  description; and a procedure for answering requests within 45 days
  (`legal/PRIVACY_REQUESTS.md`). See `legal/LEGAL_AUDIT.md` section 16.
- [x] **Subtitle and keywords:** keep the 1.1 subtitle and the drafted 1.2
  keywords (APP_STORE_LISTING.md), decided November 6, 2026.
- [x] **The guardrail choices** in the goal screen, kept as built, decided
  November 6, 2026: no goal under 800 kcal saved; under 18, no weight-loss
  goal, no calorie number of their own and no goal weight below today's; the
  calorie floor (1,200, or 1,500 for male) as a warning, not a block.
- [ ] **Give the demo account a friend**, on a second account you control, with
  sharing on and a few sessions logged, including a record and a run with a shared
  map. App Review checks Report and Block, which are only on a friend's profile,
  and without a friend the feed, grid and podium are empty. The review notes say
  the account has one.
- [x] **The demo account has Pro** (decided November 6, 2026): grant it in
  RevenueCat once the App Store app is set up (SUBSCRIPTIONS.md, step 3).

## 1. Any time before the release build

- [x] **Bring in 1.1.1 first.** Merge PR #2 into `main`, then merge `main`
  into `feature/nutrition` and run all the checks again (done October 31,
  2026, as `5e6c54c`).
- [x] **Live database** (all three migrations are additive, so the 1.1 app
  keeps working). Applied November 1, 2026, with your OK; the live schema
  matched the test database afterwards:
  - [x] `0026_subscriptions.sql`. Its Edge Functions and secrets
    (SUBSCRIPTIONS.md, "Going live with the App Store", step 4) are still to
    do, with the subscription setup below.
  - [x] `0027_nutrition.sql`.
  - [x] `0028_signup_unit.sql`: a new account starts in the weight unit the
    app sends from the phone's region. The 1.1 app sends none and still
    gets pounds.
  - [x] **The food catalog.** Loaded November 6, 2026: 13,598 foods and
    31,375 portions (Foundation 2026-10-29, SR Legacy 2018-04, FNDDS
    2024-10-31), 15 MB; the key was taken back out of `.env`. To refresh it
    with newer USDA releases later, the steps were: download Foundation Foods, SR Legacy and Survey
    Foods (FNDDS) as JSON from https://fdc.nal.usda.gov/download-datasets/
    and unzip them into a folder outside the repo, say `C:\dev\fdc`. Put
    `SUPABASE_SERVICE_ROLE_KEY` in the PC's `.env` for this step only (it is
    gitignored; never in EAS or the app), then from the folder with the 1.2
    code checked out (`C:\dev\gym-app-nutrition`; the script isn't on `main`
    yet) do a dry run first, which only counts:

    ```powershell
    npm run foods:usda -- C:\dev\fdc\foundation.json C:\dev\fdc\sr_legacy.json C:\dev\fdc\survey.json
    ```

    (use the file names the downloads unzip to). Expect about 13,545 foods and
    31,369 portions. Then the same command with `--apply` on the end, and take
    the key back out of `.env`. Running it again later updates foods in place.
- [x] **Supabase plan.** Staying on the free plan for now (decided November 6,
  2026). The catalog is 15 MB and fits, but a free project pauses after a
  week without use, and a paused project during review is a rejection
  (LEGAL_AUDIT.md section 4). Open the app, or the dashboard, in the week
  before submitting and while the build is in review.
- [ ] **Live database, security fixes. Apply as soon as you can.** Found on
  November 7, 2026, and live in 1.1 too: through the API (not the app), anyone
  could make themselves someone's friend without their agreement, or send
  requests across a block, and a friend or anyone with a pending request could
  read a person's whole profile, bodyweight included. Tested in
  `supabase/tests/friendship-integrity.test.mjs`. Needs your OK to apply each:
  - [x] `0032_friendship_integrity.sql`: requests only pending, only the
    addressee accepts, nothing else changes, no requests across a block, any
    block ends the friendship, the server stamps the accept time. The app,
    1.1 included, never did otherwise, so nothing breaks. Applied November 7,
    2026, with your OK, after two independent reviews; the live policies,
    grants and triggers were checked afterwards, and the 21 friendships were
    untouched.
  - [x] `0033_profile_names.sql`: adds the function 1.2 reads friends' names
    through. Additive. Applied the same day.
  - [ ] `0034_profiles_owner_only.sql` waits for **release day** (section 4):
    it closes the bodyweight leak, but 1.1 then shows "unknown" for friends'
    names until people update.
- [ ] **Live database, for the other countries** (store/INTERNATIONAL.md).
  Needs your OK to apply each one to the live database:
  - [x] `0030_share_choice.sql` (applied November 8, 2026, with your OK). Additive: it adds
    `profiles.share_choice_at` and marks everyone who has sharing off today
    as having chosen. Without it the first-friend question never shows.
  - [ ] `0031_private_sharing_default.sql` waits for **release day** (section
    4): it makes sharing start off for new accounts, and 1.1 has no question
    to turn it back on.
  - [x] `0035_friend_posts.sql` (applied November 8, 2026, with your OK; the live body matched `0024`). Additive: it adds
    the function behind the grid on a friend's profile, and the unit each
    post's volume is in. It replaces `rpc_friend_feed` with the same rules, so
    compare the live body's md5 with `0024` first. Without it the grid fills
    from the feed instead, and a kg lifter's volume isn't converted.
  - [x] `0036_friend_stats_unit.sql` (applied November 8, 2026, with your OK; the live body matched `0024`). Additive: it
    adds the unit a friend logs in to the end of `rpc_friend_stats`. It replaces
    that function with the same rules, so compare the live body's md5 with `0024`
    first (`25d3743a022d65d94ef79fa266b95304` with LF line endings, matched on
    November 8). Without it a friend's total, trophies and level stay
    unconverted.
- [ ] **Fill in the postal address** (`postalAddress` in `src/legal/config.ts`).
  New Zealand's privacy law requires it, and `npm run legal` refuses to
  publish the site while it is a placeholder.
- [ ] **The subscription setup** in SUBSCRIPTIONS.md, "Going live with the App
  Store", steps 1 to 7. In RevenueCat's paywall, describe Pro by what the food
  diary does, the way `PRO_FEATURE_LIST` in `src/domain/subscription.ts` does,
  with no results promised.
- [ ] **Sign in with Apple and Google:** the setup in [SIGN_IN.md](SIGN_IN.md),
  steps 1 to 3, which include migration `0029_sign_in_minimum.sql` (applied
  November 5, 2026) and the Apple secrets for `delete-account` (deployed the
  same day). Turn the Apple provider on only once those secrets are in.
- [ ] **A compile check of the new native modules** (`expo-camera`,
  `expo-localization`, `expo-apple-authentication` and Google sign-in, so set
  the Google client ID in EAS first):

  ```powershell
  eas build --platform ios --profile ios-check
  ```
- [ ] **Test on a development build** (`eas build --profile development
  --platform ios`):
  - [ ] An empty day: set a goal, then log food from search, Recent, Frequent
        and Quick add. Edit an entry, move it to another meal, delete it.
  - [ ] Scan real US products. An unknown barcode offers "Create this food".
        Deny camera access once: the screen says so, Open Settings works, and
        typing a barcode still works.
  - [ ] Create a food from a label, edit it and delete it. Copy an Open Food
        Facts product into My Foods and change a number.
  - [ ] Save a meal and log it from Meals. Build a recipe, and import one from
        a real recipe site.
  - [ ] Copy a meal, and a whole day, from the day before.
  - [ ] Airplane mode: log food, water and a weigh-in, close the app, turn the
        connection back on and open it. Everything should be there, once.
  - [ ] Goals in lb and in kg, and in kJ. A birth year under 18: no Lose, and
        Set my own refused. A goal under the floor warns; under 800 kcal won't
        save. Split by meal shows each meal's share in the diary.
  - [ ] Water, weigh-ins and the trend. After a weigh-in, Profile shows the
        same bodyweight.
  - [ ] Reports for 7 days, 30 days and 12 weeks, the food tile on Progress, and
        the food card under All stats.
  - [ ] Settings: rename a meal, add one, remove the last one; net carbs;
        exercise on and off (only runs and activities add calories).
  - [ ] With subscriptions on and a sandbox account: the Today card and the
        diary are locked, buying unlocks them, Restore works, and a lapsed
        subscription locks them again.
  - [ ] Profile > Privacy & legal > Acknowledgements opens, and Download my
        data includes the food diary. Consumer Health Data Privacy Policy
        opens and reads correctly.
  - [ ] Units from the phone's region (needs 0028): sign up a new account
        with Settings > General > Language & Region > Measurement System on
        Metric; it starts in kg, and runs in km. With Region set to
        Australia, the diary shows kJ until you choose otherwise, and still
        does after renaming a meal. Put both settings back afterwards.
  - [ ] Sign in with Apple and Google: the list in SIGN_IN.md, section 4.
  - [ ] Today's tiles: consistency matches Friends > Leaderboard; steps show
        out of 10k with a bar, and tapping them changes the goal (also in
        Profile > Daily step goal); calories left match the Food tab, and say "eaten"
        with no goal and "over" past it; the streak shows the flame. On a
        phone where steps are off, the tile says Off and opens Settings.
  - [ ] Profile: tap Bodyweight, each end of Rep range and Daily step goal,
        and type over the number where it sits. Done on the keyboard saves it,
        and it is still there after closing and reopening the app. Clearing
        Bodyweight clears it; clearing the others keeps the old number. Typing
        a low end above the high end moves the high end up. A step goal of
        7,777 becomes 8,000. Each ? opens its help and closes again.
  - [ ] Profile > Share daily steps: turning it off asks first and says what it
        deletes; Cancel leaves it on.
  - [ ] Profile > Rest timer, Usual equipment and Username open their sheets;
        Trophies and badges opens its page; tapping the header shows the XP
        sheet. With subscriptions on, Rust Strength Pro opens its sheet.
  - [ ] Progress: the three numbers match All stats; the calendar's ? shows the
        colour key; Plan and Rest day work for today and later and are gone for
        a past day; the top three records open their charts; See all and All
        stats open the full page; the Running and food tiles open their screens.
  - [ ] Friends tab, with a friend who has posted: the row across the top starts
        with You, then whoever trained today with a blue ring (gold for a new
        record), then everyone else. Tapping a person opens their profile; You
        opens Profile. A post's graphic is gold for a record, shows the route on
        a run with a shared map and never on one without. Double-tapping a post
        with no reaction of yours adds On fire and shows a flame; doing it again
        changes nothing. The four reaction buttons still add, change and clear,
        each showing its own count. A friend logging in kg shows converted to
        your unit (needs 0035).
  - [ ] Friends > trophy icon: the top three stand on the podium, second, first,
        third, with the others listed under them. Both pills change the board,
        Streak and Consistency have no period, the ? explains each figure, and
        with no friends it offers Find friends.
  - [ ] Friends > person icon: search from 3 characters, Add, requests with a number on the icon,
        Accept and Decline, Cancel on a sent request, press and hold to remove a
        friend. Back on the Friends tab, a first accepted friend brings up the
        sharing question.
  - [ ] A friend's profile: their sessions in a grid of three across; tapping one
        opens it with working reactions. A friend with sharing off shows "No
        shared sessions." Stats, trophies and badges opens everything else. The
        ... button offers Report and Block, and both work.
  - [ ] Food > add: tap a food you haven't opened recently. The amount sheet stays
        open and shows the food, first time, from search, Recent and My foods, on
        Wi-Fi and on a weak signal. Adding it closes both and the entry shows in the
        diary. The + on a Recent or Frequent row turns into a tick and logs it once.
  - [ ] Today fits on one screen without scrolling: the tiles, Start
        workout with Generate, Presets, Start a run and Log activity two to a
        row, and the body chart filling the rest. With a plan for today or on
        a small phone it may scroll a little; the chart never overlaps.
  - [ ] Progress: the calendar and chosen day work as the old Calendar did,
        Recent workouts lists everything newest first and opens workouts and
        runs, and All stats matches the old Stats tab. Pull to refresh.
  - [ ] Food tab: the diary as before, and Add food comes back to it. Paging
        between days shows no duplicate-key error in the dev server.
  - [ ] Logging a set: the suggestion shows only the set (say "230 × 6–8")
        until Show details; a set past the top of the range suggests more
        weight for the next. In a workout, the six rest presets fit on one row.
  - [ ] Sign-up has three boxes: the age, the Terms and Privacy Policy, and
        the health consent. Sign up stays greyed out until all three are
        ticked. The French links under them open the French Terms and
        Privacy Policy.
  - [ ] With Settings > General > Language & Region > Region on Germany, the
        age box says 16; on Canada, 14; on United Kingdom or United States,
        13. Put it back.
  - [ ] An account that accepted an older version sees the consent screen
        once, with the same three boxes and the French links.
  - [ ] Profile > Privacy & legal lists both French documents, and they read
        correctly.
  - [ ] Sharing (needs 0030, and 0031 on a test account or a new account
        with sharing switched off): with sharing off and no friends, nothing
        is asked. Accept a friend: the Friends tab asks once, with two
        equal buttons. "Keep private" keeps it off and the question never
        returns; on another account,
        "Share" turns on "Show my sessions in the feed" in Profile. Turning
        the Profile switch off and on never brings the question back.
  - [ ] A run's share card starts with "Show the route" off.
  - [ ] A friend who logs in the other unit: "lifted" shows their total converted
        to your unit, and their level and trophies match their own phone (needs
        0036).
  - [ ] A quick pass through lifting, running and friends.

## 2. The release build

- [ ] In `app.json`, set `"version"` to `"1.2.0"`.
- [ ] In `src/legal/config.ts`, set `lastUpdated` to today, then rebuild the
  documents without publishing the site yet, by pointing the site folder at
  one that doesn't exist (three commands, in one PowerShell window):

  ```powershell
  $env:SITE_DIR="C:\nowhere"
  ```

  ```powershell
  npm run legal
  ```

  ```powershell
  Remove-Item Env:SITE_DIR
  ```
- [ ] Rebuild the Acknowledgements from the release code (about a minute):

  ```powershell
  npm run notices
  ```
- [ ] Update the README's "At a glance" and "Tech stack" numbers.
- [ ] Run all the checks: `npm test`, `npm run lint`, `npm run typecheck`,
  `npm run test:db`, `npx expo export --platform ios`.
- [ ] **EAS environment `production`:** `EXPO_PUBLIC_REVENUECAT_IOS_KEY` set to
  the App Store key (`appl_…`) and `EXPO_PUBLIC_SUBSCRIPTIONS=on`. Without
  both, the build gives the food diary to everyone for free.
- [ ] Commit, then build and submit:

  ```powershell
  eas build --platform ios --profile production
  ```

  ```powershell
  eas submit --platform ios --latest
  ```
- [ ] From TestFlight: a sandbox purchase, a restore, and the scanner on the
  real build.

## 3. App Store Connect, on the 1.2 version

- [ ] **In-app purchases:** the two subscriptions and Lifetime, with review
  screenshots, attached to this version so they are reviewed with the build.
- [ ] **App Privacy:** add **Purchases > Purchase History** (App
  Functionality, linked to the user, not used for tracking). Health already
  covers the food diary. The full answers are in APP_STORE_LISTING.md.
- [ ] **App Review notes:** replace them with the block in
  APP_STORE_LISTING.md (it says the demo account has Pro, so grant it first).
- [ ] **Description, promotional text and keywords** from
  APP_STORE_LISTING.md, and the subtitle you chose.
- [ ] **Age rating:** answer the questionnaire again (APP_STORE_LISTING.md,
  "Age rating").
- [ ] **What's New in This Version:**

  ```
  The food diary is here, with Rust Strength Pro.
  • Search thousands of everyday foods, or scan a barcode to look up a packaged food.
  • Log meals with recent and frequent foods, quick add, saved meals, and your own foods and recipes.
  • Import a recipe from a link.
  • Calories, macros, fiber, sodium, sugars, vitamins and minerals for every meal and day.
  • A calorie goal from a calculator or your own number, with macro and nutrient targets.
  • Water and weigh-ins, with a smoothed weight trend.
  • Nutrition reports over 7 days, 30 days and 12 weeks.
  • Lifting, running, friends and trophies are free, as before.
  ```
- [ ] **Screenshots:** consider the food diary and the scanner, captioned as
  part of Pro (APP_STORE_LISTING.md, "Screenshots").
- [ ] **Publish the legal documents before submitting.** Reviewers check the
  links, and the live ones don't mention Pro or the food diary. With
  `rust-strength-site` checked out next to this repo, run `npm run legal`,
  then commit and push the site repo. Version 1.6.0 is a minor bump, so
  everyone is asked to accept once when they first open 1.2. Check the new
  `health-data.html` is live and linked from the homepage before submitting:
  the App Store description links it. Check `conditions.html` and
  `confidentialite.html` (the French versions) are live too: the English
  documents link them.
- [ ] **Submit for review with "Manually release this version"** selected.

## 4. Release day

- [ ] Release the version in App Store Connect.
- [ ] **Apply `0031_private_sharing_default.sql`** to the live database (needs
  your OK), once 1.2 is live: new accounts then start with sharing off.
- [ ] **Apply `0034_profiles_owner_only.sql`** (needs your OK), once 1.2 is
  live: nobody can read anyone else's profile row any more. Check the Friends
  list on 1.2 still shows names afterwards.
- [ ] **Turn on the countries that are ready**, following
  store/INTERNATIONAL.md. Canada, the UK and the EU each have their own
  conditions there; don't tick a country before its list is done.
- [ ] Tag the release: `git tag v1.2.0`, then `git push origin v1.2.0`.
- [ ] Check a real purchase reaches the `subscriptions` table (the webhook).
- [ ] Tell your beta testers what's new.
