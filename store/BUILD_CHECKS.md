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

### Give EAS your Supabase config

`.env` is gitignored, so EAS never receives it. Each build profile reads its
values from an EAS environment instead (pinned in `eas.json`: `development`,
`ios-check`, `android-check` and `preview` use **preview**; `production` uses
**production**). Add both values to both environments, copying them from your
`.env`:

```
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --environment preview --environment production --visibility plaintext
eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --environment preview --environment production --visibility sensitive
```

Each command prompts for the value. Do not use `--visibility secret`: these
are baked into the app bundle, which is by design (Row Level Security protects
the data, not the key), so "secret" would be misleading, and Expo advises
against it for `EXPO_PUBLIC_` variables.
Never add the Supabase **service role** key here or anywhere in this project.

`scripts/check-build-env.js` runs on every EAS build and fails it if either
value is missing — otherwise the build goes green and the app crashes on launch.

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

## Push Notifications capability

The rest-over alert is a local notification, but `expo-notifications` still
adds Apple's `aps-environment` entitlement to every build. The App ID therefore
needs **Push Notifications** ticked at developer.apple.com → Identifiers →
`com.ruststrength.app`, or signing fails with a provisioning profile that
"doesn't include the aps-environment entitlement".

An App Store Connect API key cannot change capabilities, so tick it by hand. No
push key or certificate is needed — nothing is ever pushed. The dev app ID,
`com.ruststrength.app.dev`, needs it ticked too.

## Dependencies: change the lockfile with npm 10

EAS installs with `npm ci` using **npm 10.9.8**. A lockfile written by a newer
npm (12 on this PC) can leave out packages npm 10 expects, and the build then
fails in "Install dependencies" with `Missing: <package> from lock file`. So
whenever a dependency changes, write the lockfile with EAS's version:

```
npx npm@10.9.8 install
npx npm@10.9.8 ci --include=dev
```

The second command is exactly what EAS runs; if it passes here, it passes there.

Five Expo patch updates are held back in `package.json` (`expo.install.exclude`):
`expo`, `expo-constants`, `expo-linking`, `expo-notifications`, `expo-router`.
The newer `expo` brings an `expo-modules-core` that wants `react-native-worklets`
0.10, while `react-native-reanimated` (used by the router) needs 0.12; npm then
installs two copies of a native module. The held versions are the ones the
App Store build shipped with. Drop the exclusion once a newer SDK patch lines
them up again (`npx expo-doctor` will say).

## Building the dev app without the Apple ID

Apple refuses EAS's password login for this account, so dev builds sign in
with the App Store Connect API key instead. In the PowerShell window you build
from, first set `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`,
`EXPO_APPLE_TEAM_ID` and `EXPO_APPLE_TEAM_TYPE=INDIVIDUAL`. The key cannot
register a new iPhone, so add devices by hand at developer.apple.com → Devices
(the UDID comes from `eas device:create`). If EAS ever asks for the Apple ID
password, stop: that path is what locked the account before.

## The order once Apple approves

1. `eas build --platform ios --profile production`
2. Create the app in App Store Connect with bundle id `com.ruststrength.app`
3. `eas submit -p ios`
4. TestFlight, install on your own phone, use it for a week
5. Fill in the listing from `store/APP_STORE_LISTING.md`, upload screenshots,
   answer the privacy questionnaire and the age rating
6. Submit
