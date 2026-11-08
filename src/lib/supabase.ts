import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import { env } from './env';
import type { Database } from './database.types';
import { SessionUnavailableError, isAnonymousDataRequest, requestUrl } from './sessionGuard';

/** Whether someone is signed in, as far as auth events have told us. */
let signedIn = false;

/** See `sessionGuard.ts`: a signed-in user's data requests never go out anonymously. */
const guardedFetch: typeof fetch = (input, init) => {
  if (signedIn) {
    const authorization = new Headers(init?.headers).get('Authorization');
    if (isAnonymousDataRequest(requestUrl(input), authorization, env.supabaseAnonKey)) {
      return Promise.reject(new SessionUnavailableError());
    }
  }
  return fetch(input, init);
};

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    // AsyncStorage persists the session between app launches on native.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: guardedFetch },
});

supabase.auth.onAuthStateChange((_event, session) => {
  signedIn = !!session;
});

/**
 * Who is signed in as the app opens.
 *
 * With no signal and an access token over an hour old, getSession can't refresh
 * it, so it answers "no session" with a network error, while the session itself
 * is still on the phone and works again once there's a signal. That isn't a
 * sign-out. Read as one, it puts someone in a dead spot on the sign-in screen,
 * and the session coming back looks like a new account signing in, which throws
 * away their queued sets (see AuthProvider).
 *
 * A session the server has really ended is a different error, and supabase-js
 * takes that one off the phone itself.
 */
export async function firstSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (data.session || !isAuthRetryableFetchError(error)) return data.session;
  const stored = await storedSession();
  if (stored) signedIn = true;
  return stored;
}

async function storedSession(): Promise<Session | null> {
  // Protected in supabase-js, with no public way to read it. coldStartCache.test.ts
  // runs this against the real client, so an upgrade that moves it fails there.
  const raw = await AsyncStorage.getItem(supabase.auth['storageKey']);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    return session?.user?.id ? session : null;
  } catch {
    return null;
  }
}

// The refresh timer cannot run while iOS has the app suspended, so after an
// hour away the token has expired by the time the user is back. Supabase's
// guidance for React Native: stop the timer in the background and restart it
// on return, which refreshes straight away instead of on the first request.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
