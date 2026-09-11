import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Vibration } from 'react-native';

import {
  DEFAULT_REST_SECONDS,
  adjustRest,
  clampRest,
  remainingSeconds,
} from '@/domain/restTimer';

export interface RestTimerValue {
  /** Counting down right now. */
  running: boolean;
  /** Reached zero and not yet dismissed. */
  finished: boolean;
  /** Seconds left; 0 when idle or finished. */
  remaining: number;
  /** What the current rest was set to, for the progress bar. */
  totalSeconds: number;
  /** The duration a fresh timer starts at, from the user's profile. */
  defaultSeconds: number;
  start: (seconds?: number) => void;
  /** Clear the timer entirely — used by "skip" and by dismissing the alert. */
  stop: () => void;
  /** Nudge the running timer, e.g. +15s. */
  add: (delta: number) => void;
}

const RestTimerContext = createContext<RestTimerValue | null>(null);

export function useRestTimer(): RestTimerValue {
  const value = useContext(RestTimerContext);
  if (!value) throw new Error('useRestTimer must be used inside RestTimerProvider');
  return value;
}

interface ProviderProps {
  children: ReactNode;
  /** The user's preferred rest, from their profile. */
  defaultSeconds?: number;
}

/**
 * The rest timer, held above the navigator so it keeps running while you move
 * between the workout screen and the add-set screen.
 *
 * Time comes from a wall-clock deadline, never from a counter that ticks down:
 * phones throttle timers when the screen sleeps, and a counter would quietly
 * lose whatever the system decided not to run. A deadline is either passed or
 * it is not, so the timer is still right when you look back at your phone.
 *
 * When it reaches zero the phone buzzes and the bar changes state. There is no
 * push notification — that would need notification permission and a matching
 * disclosure, for a timer that is only useful while you are holding the phone.
 */
export function RestTimerProvider({ children, defaultSeconds }: ProviderProps) {
  const preferred = clampRest(defaultSeconds ?? DEFAULT_REST_SECONDS);

  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(preferred);
  const [remaining, setRemaining] = useState(0);
  const [finished, setFinished] = useState(false);
  // Stops the buzz repeating on every tick once the deadline has passed.
  const buzzed = useRef(false);

  useEffect(() => {
    if (endsAt == null) return;

    const tick = () => {
      const left = remainingSeconds(endsAt, Date.now());
      setRemaining(left);
      if (left <= 0 && !buzzed.current) {
        buzzed.current = true;
        setFinished(true);
        Vibration.vibrate(400);
      }
    };

    tick();
    // Four times a second, so the countdown never visibly skips a number.
    const id = setInterval(tick, 250);
    // Resync the moment the app comes back, where intervals were throttled.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [endsAt]);

  const start = useCallback(
    (seconds?: number) => {
      const duration = clampRest(seconds ?? preferred);
      buzzed.current = false;
      setFinished(false);
      setTotalSeconds(duration);
      setRemaining(duration);
      setEndsAt(Date.now() + duration * 1000);
    },
    [preferred],
  );

  const stop = useCallback(() => {
    buzzed.current = false;
    setEndsAt(null);
    setRemaining(0);
    setFinished(false);
  }, []);

  /**
   * Nudge the deadline. Everything is computed here rather than inside a state
   * updater: an updater must be a pure function of the previous state, and
   * React may call it more than once, so reading the clock and touching a ref
   * from inside one is a bug waiting to surface.
   */
  const add = useCallback(
    (delta: number) => {
      if (endsAt == null) return;

      const now = Date.now();
      // Extending past zero restarts the countdown rather than leaving the bar
      // stuck in its finished state.
      const next = Math.max(endsAt, now) + delta * 1000;
      if (next > now) {
        buzzed.current = false;
        setFinished(false);
      }

      setEndsAt(next);
      setTotalSeconds((current) => adjustRest(current, delta));
    },
    [endsAt],
  );

  const value = useMemo<RestTimerValue>(
    () => ({
      running: endsAt != null && !finished,
      finished,
      remaining,
      totalSeconds,
      defaultSeconds: preferred,
      start,
      stop,
      add,
    }),
    [endsAt, finished, remaining, totalSeconds, preferred, start, stop, add],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}
