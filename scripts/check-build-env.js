/**
 * Fails an EAS build when the Supabase config is missing, or when a RevenueCat
 * Test Store key would end up in a build that isn't for development.
 *
 * `.env` is gitignored, so it is never uploaded to EAS. Without these two
 * values the build still compiles and goes green, and then the app throws on
 * launch (see src/lib/env.ts). This turns that silent crash into a failed build
 * with a message saying what to do.
 *
 * Runs from the `eas-build-post-install` hook. Does nothing outside EAS, where
 * Expo reads `.env` itself. Prints variable names only, never values.
 */

const REQUIRED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];

if (process.env.EAS_BUILD !== 'true') process.exit(0);

const missing = REQUIRED.filter((name) => !process.env[name]);

if (missing.length > 0) {
  const environment = process.env.EAS_BUILD_PROFILE
    ? `the environment used by the "${process.env.EAS_BUILD_PROFILE}" profile`
    : 'this build environment';
  console.error(
    `\nMissing on EAS: ${missing.join(', ')}\n\n` +
      `Add them to ${environment} with \`eas env:set\` (see store/BUILD_CHECKS.md).\n` +
      'Without them the app would build fine and then crash on launch.\n',
  );
  process.exit(1);
}

// RevenueCat crashes a release build on purpose if it finds a Test Store key
// (TestFlight counts as release). Only the development profile (a debug dev
// client) may carry one; anything else would build green and then crash for
// every tester the moment subscriptions start.
const revenueCatKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
if (revenueCatKey.startsWith('test_') && process.env.EAS_BUILD_PROFILE !== 'development') {
  console.error(
    `\nEXPO_PUBLIC_REVENUECAT_IOS_KEY is a RevenueCat Test Store key, which only works in development builds.\n` +
      `Remove it from the environment used by the "${process.env.EAS_BUILD_PROFILE}" profile, or set the App Store key (appl_) there.\n`,
  );
  process.exit(1);
}

console.log(`Build env OK: ${REQUIRED.join(', ')} present.`);
