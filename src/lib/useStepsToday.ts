import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getStepAccess, requestStepAccess, stepsDuring, type StepAccess } from './steps';

/** Remembers "Not now" on the steps prompt, on this phone only. */
const PROMPT_DISMISSED_KEY = 'steps:prompt-dismissed';
/** How often today's count refreshes while the screen is open. */
const REFRESH_MS = 30_000;

export interface StepsToday {
  /** Null until the first check finishes. */
  access: StepAccess | null;
  steps: number | null;
  /** The runner said "Not now" to turning steps on. */
  dismissed: boolean;
  request: () => Promise<void>;
  dismiss: () => void;
}

/**
 * Today's step count from the phone, refreshed while the screen is in view.
 * Read on the phone and never uploaded (see src/lib/steps.ts).
 */
export function useStepsToday(): StepsToday {
  const [access, setAccess] = useState<StepAccess | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    AsyncStorage.getItem(PROMPT_DISMISSED_KEY)
      .then((v) => alive.current && setDismissed(v != null))
      .catch(() => undefined);
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

  const dismiss = useCallback(() => {
    setDismissed(true);
    AsyncStorage.setItem(PROMPT_DISMISSED_KEY, new Date().toISOString()).catch(() => undefined);
  }, []);

  return { access, steps, dismissed, request, dismiss };
}
