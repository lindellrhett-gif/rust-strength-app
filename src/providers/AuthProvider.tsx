import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  userId: string | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /**
   * Throw away every cached query when the signed-in account changes.
   *
   * Without this, signing out leaves one person's profile, workouts, personal
   * records, friends and feed sitting in the React Query cache. The next person
   * to sign in on the same phone is served that cache while their own data
   * loads — and with a 30-second stale time, a query mounted soon enough never
   * refetches at all. Deleting an account already clears the cache; plain
   * signing out has to do the same.
   *
   * Keyed on the user id rather than on the event, so a routine token refresh
   * does not throw away data the user is looking at.
   */
  const lastUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const id = session?.user.id ?? null;
    if (lastUserId.current === undefined) {
      lastUserId.current = id;
      return;
    }
    if (lastUserId.current !== id) {
      lastUserId.current = id;
      queryClient.clear();
    }
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      userId: session?.user.id ?? null,
      initializing,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
