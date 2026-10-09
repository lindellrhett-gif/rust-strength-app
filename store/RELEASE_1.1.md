# Releasing 1.1 (running)

Everything the running update needs on top of the usual
[build checks](BUILD_CHECKS.md). Work through it in order. The steps marked
**release day** must wait until Apple has approved the build and you are
releasing it.

## 1. Any time before the release build

- [ ] **Run the database migrations on the live project.** In the Supabase
  SQL editor, paste and run each file in order: `0017`, `0018`, `0019`,
  `0021`, `0022`, `0023`. The 1.0 app never calls anything they add, so
  they are safe now, and a development build of 1.1 needs them to save and
  show runs. **Skip `0020`** (see section 4).
- [ ] **Let EAS sign the new widget extension, once.** The Lock Screen view
  is a separate app extension (`com.ruststrength.app.dev.widget` for the dev
  app, `com.ruststrength.app.widget` for the store app), and EAS has to
  create its identifier and provisioning profile. That needs the App Store
  Connect API key, the way it did for the first builds: sync the PC clock,
  set the `EXPO_ASC_*` variables, and answer **Yes** to logging in to Apple
  (`store/BUILD_CHECKS.md` explains how). If it ever asks for your Apple
  ID password, press Ctrl+C. Later builds reuse the stored profiles.
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
  - [ ] Steps and cadence on the run summary, and Today's steps card.
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
- [ ] In `app.json`, set `"version"` to `"1.1.0"`. The build number counts up
  by itself (EAS remote versioning).
- [ ] In `src/legal/config.ts`, set `lastUpdated` to today's date, then run
  `npm run legal` with `SITE_DIR` pointing at a folder that doesn't exist,
  so the date is right in the app without publishing the site yet:

  ```powershell
  $env:SITE_DIR="C:\nowhere"; npm run legal; Remove-Item Env:SITE_DIR
  ```
- [ ] Update the README's "At a glance" and "Tech stack" numbers (lines of
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
  • Auto-pause at lights, and spoken updates every mile or kilometre.
  • A summary for every run, with pace and elevation charts. Edit or trim a run afterwards.
  • Running history in Stats: weekly and monthly distance, a weekly goal, and records from the mile to the marathon.
  • Save a route, run it again and compare your attempts.
  • Share runs with friends. Maps are off unless you turn them on, and the start and end are always hidden.
  • Enter treadmill runs by hand.
  • Every activity now counts toward your streak.
  ```
- [ ] **Screenshots:** consider adding one of the recorder and one of a run
  summary (`npm run screenshots` resizes them).
- [ ] **Description and keywords:** consider mentioning running. Keep any
  claim to what the app actually does.

## 4. Release day

Do these as soon as 1.1 is live in the App Store, in this order:

- [ ] **Run `0020_streaks_count_activities.sql`** on the live project. Before
  this, friends would see a streak that counts activities while the 1.0 app
  still counts workouts only. People who haven't updated yet will see their
  own streak and their friends' disagree until they do.
- [ ] **Publish the legal documents.** With `rust-strength-site` checked out
  next to this repo, run `npm run legal`, then commit and push the site
  repo. The public Privacy Policy then matches the app (version 1.5.0).
  Everyone who opens 1.1 is asked to accept the new version once.
- [ ] Tag the release: `git tag v1.1.0`, then `git push origin v1.1.0`.
- [ ] Tell your beta testers what's new.
