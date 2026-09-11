import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { onboardingKey } from '@/domain/onboarding';
import { useAuth } from '@/providers/AuthProvider';

export interface OnboardingState {
  /** True once we know the answer and the cards should be on screen. */
  show: boolean;
  dismiss: () => void;
  /** Puts the cards back, for the "How this app works" row in Profile. */
  replay: () => void;
}

/** `unknown` until storage answers, so nothing flashes on screen meanwhile. */
type Decision = 'unknown' | 'show' | 'hide';

/**
 * Whether to show the welcome cards.
 *
 * Kept in device storage rather than on the profile, so this needed no schema
 * change. The trade-off is that the cards appear again if the same person
 * installs the app on a second phone — which for an intro tour is reasonable,
 * and is why there is also a way to replay them by hand.
 *
 * A read that fails (storage cleared, private mode, a platform blocking it) is
 * treated as "already seen": showing a returning user the intro is worse than a
 * new user missing it and finding it in Profile.
 */
export function useOnboarding(): OnboardingState {
  const { userId } = useAuth();
  const [decision, setDecision] = useState<Decision>('unknown');

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    AsyncStorage.getItem(onboardingKey(userId))
      .then((seen) => {
        if (!cancelled) setDecision(seen == null ? 'show' : 'hide');
      })
      .catch(() => {
        if (!cancelled) setDecision('hide');
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const dismiss = useCallback(() => {
    setDecision('hide');
    if (!userId) return;
    // Best effort: failing to record it means the cards show once more, which
    // is not worth surfacing an error for.
    AsyncStorage.setItem(onboardingKey(userId), new Date().toISOString()).catch(() => {});
  }, [userId]);

  const replay = useCallback(() => setDecision('show'), []);

  return {
    // Derived rather than stored, so signing out hides the cards without an
    // effect having to reach in and reset anything.
    show: !!userId && decision === 'show',
    dismiss,
    replay,
  };
}
