import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
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
