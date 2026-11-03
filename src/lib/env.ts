/**
 * Reads the two public Supabase values from the Expo env. They are injected at
 * build time from `.env` (see `.env.example`). Both are safe in a client bundle.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase config. Copy .env.example to .env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart ' +
      'the dev server with `npx expo start -c`.',
  );
}

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  /**
   * RevenueCat's public iOS SDK key (it starts appl_). Public by design, like
   * the anon key: it can only read offerings and make purchases for the
   * signed-in person. The secret key never goes in the app.
   */
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || null,
  /** Subscriptions stay off unless this is "on" (see src/lib/purchases.ts). */
  subscriptionsSwitch: process.env.EXPO_PUBLIC_SUBSCRIPTIONS === 'on',
  /**
   * Google's OAuth client id for this iOS app (it ends
   * .apps.googleusercontent.com). Public by design: it names the app to
   * Google and is built into every copy. Without it the app doesn't offer
   * Sign in with Google (src/lib/socialSignIn.ts).
   */
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || null,
  /** The same for the dev app (com.ruststrength.app.dev), which Google treats as another app. */
  googleIosClientIdDev: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV || null,
};
