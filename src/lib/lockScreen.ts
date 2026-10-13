/**
 * Whether the Lock Screen and Dynamic Island views (the run and the rest
 * timer, both iOS Live Activities) can show on this phone, and the last thing
 * that went wrong showing them. Running settings shows this, so a view that
 * doesn't appear can be explained instead of failing silently.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

interface RunActivityNative {
  areEnabled(): boolean;
}

const run = Platform.OS === 'ios' ? requireOptionalNativeModule<RunActivityNative>('RunActivity') : null;
const rest = Platform.OS === 'ios' ? requireOptionalNativeModule('RestActivity') : null;

let lastProblem: string | null = null;

/** Notes a failure to show, update or end a view; in development it is also logged. */
export function noteLockScreenProblem(what: 'Run' | 'Rest', error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  lastProblem = `${what}: ${message}`;
  if (__DEV__) console.warn(`[Lock Screen] ${lastProblem}`);
}

export type LockScreenAvailability =
  /** Not iOS, or a build from before these views existed. */
  | 'missing'
  /** Live Activities are turned off for the app in Settings. */
  | 'off'
  | 'on';

export function lockScreenAvailability(): LockScreenAvailability {
  if (!run || !rest) return 'missing';
  try {
    return run.areEnabled() ? 'on' : 'off';
  } catch {
    return 'missing';
  }
}

export function lastLockScreenProblem(): string | null {
  return lastProblem;
}
