import { createContext, useContext, type ReactNode } from 'react';

import { OnboardingCards } from '@/components/OnboardingCards';
import { useOnboarding, type OnboardingState } from '@/data/onboarding';

const OnboardingContext = createContext<OnboardingState | null>(null);

/**
 * Owns the welcome cards and the one piece of state behind them.
 *
 * A context rather than a bare hook, because two screens need the same
 * instance: this provider decides whether to show the cards on first sign-in,
 * and the Profile screen has a row that puts them back.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const state = useOnboarding();

  return (
    <OnboardingContext.Provider value={state}>
      {children}
      <OnboardingCards visible={state.show} onDone={state.dismiss} />
    </OnboardingContext.Provider>
  );
}

/** Null outside the provider, so screens can degrade rather than crash. */
export function useOnboardingControls(): OnboardingState | null {
  return useContext(OnboardingContext);
}
