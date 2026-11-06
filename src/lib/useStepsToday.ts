import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getStepAccess, requestStepAccess, stepsDuring, type StepAccess } from './steps';

/** How often today's count refreshes while the screen is open. */
const REFRESH_MS = 30_000;

export interface StepsToday {
  /** Null until the first check finishes. */
  access: StepAccess | null;
  steps: number | null;
  request: () => Promise<void>;
}

/**
 * Today's step count from the phone, refreshed while the screen is in view.
 * Read on the phone and never uploaded (see src/lib/steps.ts).
 */
export function useStepsToday(): StepsToday {
  const [access, setAccess] = useState<StepAccess | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const a = await getStepAccess();
    if (!alive.current) return;
    setAccess(a);
    if (a !== 'granted') return;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const count = await stepsDuring([[midnight.getTime(), Date.now()]]);
    if (alive.current) setSteps(count);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(() => void refresh(), REFRESH_MS);
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') void refresh();
      });
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [refresh]),
  );

  const request = useCallback(async () => {
    const a = await requestStepAccess();
    if (alive.current) setAccess(a);
    await refresh();
  }, [refresh]);

  return { access, steps, request };
}
