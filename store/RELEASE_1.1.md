# Releasing 1.1 (running)

Everything the running update needs on top of the usual
[build checks](BUILD_CHECKS.md). Work through it in order. The steps marked
**release day** must wait until Apple has approved the build and you are
releasing it.

## 1. Any time before the release build

- [x] **Run the database migrations on the live project:** `0017`, `0018`,
  `0019`, `0021`, `0022`, `0023` (done October 10, 2026). The 1.0 app never
  calls anything they add, and a development build of 1.1 needs them to
  save and show runs. **`0020` is still to run** (see section 4).
- [x] **Run `0024_steps_trophies_leaderboards.sql` on the live project.**
  Additive like the others: it only adds columns to what 1.0 reads (by
  name), and the dev build needs it for the new trophies, leaderboards,
  daily steps and featured trophies. **Not `0025`** (see section 4).
- [x] **Let EAS sign the new widget extension, once** (done October 18, 2026;
  the widget and the app now share one distribution certificate). The Lock Screen view
  is a separate app extension (`com.ruststrength.app.dev.widget` for the dev
  app, `com.ruststrength.app.widget` for the store app), and EAS has to
  create its identifier and provisioning profile. That needs the App Store
  Connect API key: sync the PC clock, then run
  `& .\scripts\eas-build-asc.ps1 development` in a terminal (and
  `production` for the store build). If it ever asks for your Apple ID
  password, press Ctrl+C. Later builds reuse the stored profiles. The dev
  app is done; the first production build (below) does the store app.
- [ ] **Test a TestFlight build before the release build.** It is the real
  store app with the code built in, so it runs outdoors with no PC, and it
  uses the live database like the dev build. Installing it replaces the App
  Store version on your phone (same app, same account; reinstall from the
  App Store to go back). Build and send it to App Store Connect with:

  ```powershell
  & .\scripts\eas-build-asc.ps1 production -Submit
  ```

  Once Apple has processed it, add yourself under TestFlight > Internal
  Testing in App Store Connect; internal builds need no review. Keep 1.1
  builds out of the external tester group until the Privacy Policy that
  covers location and steps is published (section 4), since testers there
  would be sharing both.
- [ ] **Test on a development build** (`eas build --profile development
  --platform ios`):
  - [ ] A real outdoor run with the phone locked the whole way.
  - [ ] Auto-pause at a light: the clock holds, then starts as you move off.
  - [ ] Spoken updates with music playing and the phone locked: the music
        gets quieter while it talks, then comes back.
  - [ ] Force-quit the app mid-run, reopen it, and choose Resume, then do it
        again and choose Finish.
  - [ ] The Lock Screen and Dynamic Island: the clock ticks, distance and
        pace update every few seconds, "Paused" and "Auto-paused" show at a
        pause and a light, tapping it opens the recorder, and it disappears
        when the run is saved or discarded. After a force-quit it should say
        "Not updating" within about three minutes.
  - [ ] The rest timer on the Lock Screen: log a set, lock the phone, and
        the countdown and next set show; when the time is up it says
        "Rest's up" by itself; "+15s" and skipping in the app update it; it
        goes when the workout is finished or cancelled.
  - [ ] Signing up with an email that already has an account says so and
        offers Sign in and Reset password.
  - [ ] A past day on the Calendar has no Plan a session button.
  - [ ] Logging a set lists every set from last time, top set in bold.
  - [ ] Searching exercises with a typo ("bech press", "dumbell") still
        finds them.
  - [ ] Finishing a run: the "Show map to friends" switch is there, off;
        your own feed shows the outline either way, a friend's only with it
        on.
  - [ ] Profile > Share daily steps: asks for Motion & Fitness, you appear
        on the Steps board, and turning it off takes you off again.
  - [ ] The Run distance and Steps leaderboards, and the new Distance Run,
        Steps, Friends and Reactions trophies.
  - [ ] A trophy's Show by my name: it appears by your name on your
        profile and in a friend's feed and profile view; a third replaces
        the oldest.
  - [ ] The Calendar offers no "Mark as rest day" on past days.
  - [ ] Steps and cadence on the run summary, and Today's steps card.
  - [ ] **Share cards** (needs a build made after October 25, 2026: they
        add three native modules). After a workout, "Share workout card" on
        the summary (and "Share" at the top of any past workout); after a
        run, "Share run card". Check the card looks right, Share opens the
        share sheet with Instagram in it, and Save to Photos asks for
        permission once, then the image is in Photos at full size. On a run
        card, the route starts and ends away from home, and "Show the
        route" off removes it.
  - [ ] **Assisted machines:** an assisted exercise you created as Weights
        offers "Switch to Assisted" on the set screen; after switching, its
        old sets show as assistance and a hard set suggests more assistance,
        not less.
  - [ ] Airplane mode on before saving, then off: the run appears.
  - [ ] A friend's view: stats only by default; with the map shared, the
        outline starts and ends away from home (add a privacy zone first).
  - [ ] A saved route: run it again and check the attempts list.
  - [ ] A treadmill run entered by hand.
  - [ ] Battery: note the percentage before and after a run of about an
        hour. The README doesn't give a figure until there is a real one.
  - [ ] A quick pass through lifting, the feed, the leaderboard and streaks,
        to check nothing else broke.
- [ ] **Attorney question** (optional, your call): location combined with
  fitness data under Washington's My Health My Data Act. See
  `legal/LEGAL_AUDIT.md` sections 5 and 14. Nothing here has been reviewed by
  a lawyer.

## 2. The release build

- [ ] Merge `feature/running` into `main` (a pull request is easiest to
  review).
- [x] In `app.json`, set `"version"` to `"1.1.0"` (done for the TestFlight
  build). The build number counts up by itself (EAS remote versioning).
- [x] In `src/legal/config.ts`, set `lastUpdated` to today's date (October 26, 2026), then run
  `npm run legal` with `SITE_DIR` pointing at a folder that doesn't exist,
  so the date is right in the app without publishing the site yet:

  ```powershell
  $env:SITE_DIR="C:\nowhere"; npm run legal; Remove-Item Env:SITE_DIR
  ```
- [x] Update the README's "At a glance" and "Tech stack" numbers (lines of
  code, migrations, test counts) from the merged code.
- [ ] Run all the checks: `npm test`, `npm run lint`, `npm run typecheck`,
  `npm run test:db`, `npx expo export --platform ios`.
- [ ] Commit, then build and submit:

  ```powershell
  eas build --platform ios --profile production
  ```

  ```powershell
  eas submit --platform ios --latest
  ```
- [ ] Install it from TestFlight and repeat the outdoor run, the locked-phone
  spoken updates, the Lock Screen view and the crash recovery once on the
  real build.

## 3. App Store Connect, on the new 1.1 version

- [ ] **App Privacy:** add **Precise Location** (App Functionality, linked to
  the user, not used for tracking). The full answers are in
  [APP_STORE_LISTING.md](APP_STORE_LISTING.md), "App Privacy".
- [ ] **App Review notes:** replace them with the block in
  APP_STORE_LISTING.md, which now explains the location and audio
  background modes. Reviewers often ask about background location, so this
  saves a round trip.
- [ ] **What's New in This Version:**

  ```
  Running is here.
  • Record runs with GPS, with the screen locked: live map, distance, pace, splits and steps.
  • Your time, distance and pace on the Lock Screen and in the Dynamic Island while you run.
  • The rest timer and your next set on the Lock Screen and in the Dynamic Island.
  • Auto-pause at lights, and spoken updates every mile or kilometre.
  • A summary for every run, with pace and elevation charts. Edit or trim a run afterwards.
  • Running history in Stats: weekly and monthly distance, a weekly goal, and records from the mile to the marathon.
  • Save a route, run it again and compare your attempts.
  • Share runs with friends. Maps are off unless you turn them on, and the start and end are always hidden.
  • Enter treadmill runs by hand.
  • Every activity now counts toward your streak.
  • Logging a set shows every set from last time, not just the best one.
  • Exercise search forgives typos.
  • Signing up with an email that already has an account now says so.
  • You can no longer plan a session or a rest day on a day that has passed.
  • New leaderboards for distance run and steps, and new trophies for running, steps, friends and reactions.
  • Show your two favourite trophies next to your name.
  • Choose whether friends see each run's map when you finish it.
  • Share a card after every workout or run, to Instagram, Messages or Photos.
  • Assisted machines: suggestions now add assistance after a hard set, and an assisted exercise set up as Weights can be switched over.
  ```
- [ ] **Screenshots:** consider adding one of the recorder and one of a run
  summary (`npm run screenshots` resizes them).
- [ ] **Description and keywords:** consider mentioning running. Keep any
  claim to what the app actually does.
- [ ] **Publish the legal documents before submitting.** The reviewer checks
  the Privacy Policy link, and the live one (1.4.x) still says no location
  is collected. With `rust-strength-site` checked out next to this repo, run
  `npm run legal`, then commit and push the site repo. The public policy
  then matches the app (version 1.5.0). Publishing asks nobody to accept
  anything: the prompt comes from the version built into the app, so it
  appears once when people first open 1.1.
- [ ] **Submit for review with "Manually release this version"** selected,
  so you choose the moment it goes live and can run the release-day steps
  straight after.

## 4. Release day

Do these as soon as you release 1.1 in App Store Connect, in this order:

- [ ] **Run `0020_streaks_count_activities.sql`** on the live project. Before
  this, friends would see a streak that counts activities while the 1.0 app
  still counts workouts only. People who haven't updated yet will see their
  own streak and their friends' disagree until they do.
- [ ] **Run `0025_rest_days_not_in_past.sql`**, which stops rest days being
  added for past days. Anyone still on 1.0 then gets an error if they try.
- [ ] Tag the release: `git tag v1.1.0`, then `git push origin v1.1.0`.
- [ ] Tell your beta testers what's new.
