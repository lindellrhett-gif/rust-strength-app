# Releasing 1.2 (the food diary and Rust Strength Pro)

1.2 is the first version that sells something: the food diary is the paid
feature of Rust Strength Pro. So this checklist carries the subscription launch
in [SUBSCRIPTIONS.md](SUBSCRIPTIONS.md) as well as the food diary, on top of the
usual [build checks](BUILD_CHECKS.md). Work through it in order. The steps
marked **release day** wait until Apple has approved the build.

Nothing here has been reviewed by a lawyer.

## 0. Decisions only you can make

None of these can be settled from the code, and some block the rest:

- [ ] **Prices and any free trial** (SUBSCRIPTIONS.md, "Still yours to decide").
- [ ] **Who sells it:** Apple pays and lists you personally on an Individual
  account, while the documents name Bluestem Software LLC (SUBSCRIPTIONS.md,
  "Before anything goes on sale").
- [ ] **Consumer health data.** The food diary is health data by any reading
  (what you eat, your weight). See `legal/LEGAL_AUDIT.md` section 16 for the
  options before publishing.
- [ ] **Subtitle and keywords** for 1.2 (APP_STORE_LISTING.md).
- [ ] **The guardrail choices** in the goal screen (PR #3, step 7): no goal
  under 800 kcal saved; under 18, no weight-loss goal, no calorie number of
  their own and no goal weight below today's; the calorie floor (1,200, or
  1,500 for male) as a warning, not a block.

## 1. Any time before the release build

- [x] **Bring in 1.1.1 first.** Merge PR #2 into `main`, then merge `main`
  into `feature/nutrition` and run all the checks again (done October 31,
  2026, as `5e6c54c`).
- [ ] **Live database, each with your named OK** (all three migrations are
  additive, so the 1.1 app keeps working):
  - [ ] `0026_subscriptions.sql`, with the Edge Functions and secrets in
    SUBSCRIPTIONS.md, "Going live with the App Store", step 4.
  - [ ] `0027_nutrition.sql`.
  - [ ] `0028_signup_unit.sql`: a new account starts in the weight unit the
    app sends from the phone's region. The 1.1 app sends none and still
    gets pounds.
  - [ ] **The food catalog.** Download Foundation Foods, SR Legacy and Survey
    Foods (FNDDS) as JSON from https://fdc.nal.usda.gov/download-datasets/
    and unzip them into a folder outside the repo, say `C:\dev\fdc`. Put
    `SUPABASE_SERVICE_ROLE_KEY` in the PC's `.env` for this step only (it is
    gitignored; never in EAS or the app), then from `C:\dev\gym-app` do a dry
    run first, which only counts:

    ```powershell
    npm run foods:usda -- C:\dev\fdc\foundation.json C:\dev\fdc\sr_legacy.json C:\dev\fdc\survey.json
    ```

    (use the file names the downloads unzip to). Expect about 13,545 foods and
    31,369 portions. Then the same command with `--apply` on the end, and take
    the key back out of `.env`. Running it again later updates foods in place.
- [ ] **Supabase plan.** The catalog is about 16 MB and fits the free plan,
  but a free project pauses after a week without use, and a paused project
  during review is a rejection (LEGAL_AUDIT.md section 4).
- [ ] **The subscription setup** in SUBSCRIPTIONS.md, "Going live with the App
  Store", steps 1 to 7. In RevenueCat's paywall, describe Pro by what the food
  diary does, the way `PRO_FEATURE_LIST` in `src/domain/subscription.ts` does,
  with no results promised.
- [ ] **A compile check of the new native modules** (`expo-camera` and
  `expo-localization`):

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
  - [ ] Reports for 7 days, 30 days and 12 weeks, and the Stats card.
  - [ ] Settings: rename a meal, add one, remove the last one; net carbs;
        exercise on and off (only runs and activities add calories).
  - [ ] With subscriptions on and a sandbox account: the Today card and the
        diary are locked, buying unlocks them, Restore works, and a lapsed
        subscription locks them again.
  - [ ] Profile > Privacy & legal > Acknowledgements opens, and Download my
        data includes the food diary.
  - [ ] Units from the phone's region (needs 0028): sign up a new account
        with Settings > General > Language & Region > Measurement System on
        Metric; it starts in kg, and runs in km. With Region set to
        Australia, the diary shows kJ until you choose otherwise, and still
        does after renaming a meal. Put both settings back afterwards.
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
  APP_STORE_LISTING.md, and fill in whether the demo account has Pro.
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
  everyone is asked to accept once when they first open 1.2.
- [ ] **Submit for review with "Manually release this version"** selected.

## 4. Release day

- [ ] Release the version in App Store Connect.
- [ ] Tag the release: `git tag v1.2.0`, then `git push origin v1.2.0`.
- [ ] Check a real purchase reaches the `subscriptions` table (the webhook).
- [ ] Tell your beta testers what's new.
