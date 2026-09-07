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
};
