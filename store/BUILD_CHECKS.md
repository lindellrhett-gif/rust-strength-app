# Build checks you can run before Apple approves you

TestFlight needs an active Apple Developer Program membership — it lives inside
App Store Connect, and a build cannot be uploaded without a Team ID and signing
credentials. That part genuinely has to wait.

What does not have to wait is finding out whether the app **compiles as a real
native binary**. Expo Go is not that. It ships its own copy of several native
modules, which is exactly how a missing `expo-font` dependency sat undetected in
this project until `expo-doctor` found it — the app worked perfectly in Expo Go
and would have failed the first real build.

Both checks below need a free Expo account and no Apple account at all.

## One-time setup

```
npm install -g eas-cli
eas login
eas init
```

`eas init` links this folder to a project on your Expo account. It is free and
it does not touch Apple.

## Check 1 — does it build for iOS?

```
eas build --platform ios --profile ios-check
```

This is a **simulator build**, which needs no code signing and therefore no
Apple Developer account. It runs on Expo's macOS machines and does the real
work: installs the pods, applies every config plugin, autolinks and compiles
every native module, and produces an app.

You cannot run the result on Windows or on your iPhone. That is not the point.
The point is that the iOS native build either goes green or it does not, and if
it fails you get the log and can fix it now instead of on the clock after Apple
approves you.

**This is the highest-value thing you can do while waiting.** It is the same
compile that the production build will do, minus the signing.

## Check 2 — a standalone app you can actually hold

```
eas build --platform android --profile android-check
```

Produces an installable APK. Worth doing if you can get hold of any Android
phone, even briefly, because it is the only way right now to use the app as a
**standalone binary** rather than through Expo Go.

That difference matters more than it sounds. A standalone build is what
TestFlight will be. Things that behave differently outside Expo Go:

- Native modules resolve from your own dependency list, not Expo Go's
- The splash screen, icon and app name are yours
- App Transport Security is enforced as configured
- Deep links use your scheme
- Offline behaviour is the real thing, not a dev-server fallback

## What you can already do without any build at all

- **Create the App Review demo account** and log real sessions on it, straight
  from Expo Go against your production database.
- **Take the App Store screenshots.** Expo Go renders the app full screen, so
  the screenshots are valid. Run them through `npm run screenshots` afterwards.
- **Test offline.** Airplane mode works the same in Expo Go.

## The order once Apple approves

1. `eas build --platform ios --profile production`
2. Create the app in App Store Connect with bundle id `com.ruststrength.app`
3. `eas submit -p ios`
4. TestFlight, install on your own phone, use it for a week
5. Fill in the listing from `store/APP_STORE_LISTING.md`, upload screenshots,
   answer the privacy questionnaire and the age rating
6. Submit
