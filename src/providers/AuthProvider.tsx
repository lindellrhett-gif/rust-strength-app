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

import { persister, queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  userId: string | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * True from the moment a reset code is submitted until the new password is
   * saved or the reset is abandoned. The code signs the user in, and without
   * this the auth layout would whisk them into the app before they had chosen
   * a new password.
   */
  recovering: boolean;
  sendResetCode: (email: string) => Promise<void>;
  /** Checks the emailed code. Signs the user in, with `recovering` held true. */
  verifyResetCode: (email: string, code: string) => Promise<void>;
  /** Saves the new password and ends the reset. */
  setNewPassword: (password: string) => Promise<void>;
  /** Leaves a half-finished reset, signing out if the code was already used. */
  abandonReset: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [recovering, setRecovering] = useState(false);
  // Mirrors `recovering` for the async functions below. They are created once
  // per render, and a screen can still hold an old copy when it unmounts — an
  // old copy reading stale state could sign someone out right after a reset
  // that succeeded.
  const recoveringRef = useRef(false);

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
   * The cache is also written to disk so the app works without a signal, so
   * the stored copy has to go with it — otherwise one person's training would
   * sit in storage on a phone somebody else is now signed in to.
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
      void persister.removeClient();
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
      recovering,
      sendResetCode: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
      },
      verifyResetCode: async (email, code) => {
        // Set before the request, not after: the session lands through
        // onAuthStateChange, and the layout must already know to stay put.
        recoveringRef.current = true;
        setRecovering(true);
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
        if (error) {
          recoveringRef.current = false;
          setRecovering(false);
          throw error;
        }
      },
      setNewPassword: async (password) => {
        // On failure `recovering` stays true, so the user is still on the form
        // and can try another password without needing a fresh code.
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        recoveringRef.current = false;
        setRecovering(false);
      },
      abandonReset: async () => {
        // A used code has already signed them in with the old password still
        // set. Leaving that session behind would be a sign-in they never
        // finished, so end it.
        if (!recoveringRef.current) return;
        recoveringRef.current = false;
        await supabase.auth.signOut().catch(() => {});
        setRecovering(false);
      },
    }),
    [session, initializing, recovering],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
