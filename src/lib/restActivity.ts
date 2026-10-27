/**
 * The rest timer on the Lock Screen and in the Dynamic Island, through the
 * local native module in modules/live-activities, drawn by the widget
 * extension in targets/widget. RestTimerProvider calls syncRestActivity
 * whenever the timer or the next set changes.
 *
 * The app is usually asleep while you rest, so it can't send an update when
 * the time is up. Each update instead tells iOS the content goes stale when
 * the rest ends, and the widget shows "Rest's up" from then on by itself.
 *
 * Builds from before the native module existed, Android, and phones with Live
 * Activities turned off simply go without; the timer works the same either
 * way. Everything happens on the phone: no push token, nothing sent anywhere.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { RestActivityState } from '@/domain/restActivity';

import { noteLockScreenProblem } from './lockScreen';

interface RestActivityNative {
  start(state: RestActivityState): Promise<boolean>;
  end(): Promise<void>;
}

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<RestActivityNative>('RestActivity') : null;

/** Quick changes in a row (a few taps of +15s) go out as one update. */
const SETTLE_MS = 400;

let showing = false;
let lastSent: string | null = null;
let pending: RestActivityState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

// One native call at a time, so an update can never land after the end.
let queue: Promise<unknown> = Promise.resolve();
function serial(fn: () => Promise<unknown>): void {
  queue = queue.then(fn, fn).catch((e) => noteLockScreenProblem('Rest', e));
}

function flush(): void {
  timer = null;
  const state = pending;
  pending = null;
  if (!native || !state) return;
  const key = JSON.stringify(state);
  if (key === lastSent) return;
  lastSent = key;
  serial(async () => {
    showing = await native.start(state);
    if (!showing) noteLockScreenProblem('Rest', 'Live Activities are turned off for this app');
  });
}

/** Shows or updates the rest, or takes it away with null. */
export function syncRestActivity(state: RestActivityState | null): void {
  if (!native) return;
  if (state == null) {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
    if (!showing && lastSent == null) return;
    showing = false;
    lastSent = null;
    serial(() => native.end());
    return;
  }
  pending = state;
  // The first one goes straight away: iOS only starts an activity while the
  // app is open, and the phone may be locked a moment after the set is in.
  if (lastSent == null) flush();
  else if (!timer) timer = setTimeout(flush, SETTLE_MS);
}

/**
 * Clears a rest left on the Lock Screen by an earlier launch (the app was
 * closed mid-rest). Called once when the timer first mounts, with no rest
 * running.
 */
export function endLeftoverRestActivity(): void {
  if (!native) return;
  serial(() => native.end());
}
