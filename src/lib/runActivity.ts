/**
 * The run on the Lock Screen and in the Dynamic Island: an iOS Live Activity,
 * through the local native module in modules/run-activity, drawn by the
 * widget extension in targets/widget.
 *
 * It starts when GPS tracking starts, which is always from the open app (the
 * only time iOS lets an activity start), follows the run from then on,
 * including with the phone locked, and ends when tracking stops: on finish,
 * discard or sign-out. What it shows and when an update is worth sending are
 * decided in src/domain/running/liveActivity.ts.
 *
 * Builds from before the native module existed, Android, and phones with Live
 * Activities turned off in Settings simply go without; the run records the
 * same either way.
 *
 * Privacy: all of this happens on the phone. There is no push token and
 * nothing is sent anywhere.
 */
import { requireOptionalNativeModule } from 'expo';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import type { ActiveRun } from '@/domain/running/activeRunStore';
import {
  RUN_ACTIVITY_TIMING,
  runActivityState,
  shouldUpdate,
  type RunActivityState,
} from '@/domain/running/liveActivity';
import { liveStatsAt, prepareLive } from '@/domain/running/summarize';

import { runStore } from './runStore';

interface RunActivityNative {
  areEnabled(): boolean;
  start(state: RunActivityState, deepLink: string, staleAfterMs: number): Promise<boolean>;
  update(state: RunActivityState, staleAfterMs: number): Promise<boolean>;
  end(): Promise<void>;
}

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<RunActivityNative>('RunActivity') : null;

let showing = false;
let lastSent: RunActivityState | null = null;
let lastSentAt = 0;
let lastCheck = 0;
let lastStatus: string | null = null;

// One native call at a time, so an update can never land after the end.
let queue: Promise<unknown> = Promise.resolve();
function serial(fn: () => Promise<unknown>): Promise<void> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next.then(
    () => undefined,
    () => undefined,
  );
}

function stateFor(run: ActiveRun, now: number): RunActivityState | null {
  const { recorder, autoPause, unit } = run.meta;
  if (recorder.status !== 'recording' && recorder.status !== 'paused') {
    return runActivityState(recorder, null, unit, now);
  }
  const live = liveStatsAt(prepareLive(run.fixes, autoPause), recorder, now, { autoPause, unit });
  return runActivityState(recorder, live, unit, now);
}

/** Shows the run in progress, or takes over the activity already showing. */
export function startRunActivity(): Promise<void> {
  if (!native) return Promise.resolve();
  return serial(async () => {
    const run = runStore.current();
    if (!run) return;
    const now = Date.now();
    const state = stateFor(run, now);
    if (!state) return;
    showing = await native.start(state, Linking.createURL('/run/record'), RUN_ACTIVITY_TIMING.staleAfterMs);
    if (!showing) return;
    lastSent = state;
    lastSentAt = now;
    lastCheck = now;
    lastStatus = run.meta.recorder.status;
  });
}

export function endRunActivity(): Promise<void> {
  if (!native) return Promise.resolve();
  showing = false;
  lastSent = null;
  lastStatus = null;
  return serial(() => native.end());
}

/**
 * Brings the activity up to date with the run, if anything shown has
 * changed. Cheap to call often: pausing, resuming and the countdown ending go
 * out at once, and otherwise the numbers are worked out at most every few
 * seconds. Called on every change to the run, and after every batch of GPS
 * fixes, which keep arriving while paused so the activity stays fresh.
 */
export function syncRunActivity(run: ActiveRun | null, now = Date.now()): void {
  if (!native || !showing || !run) return;
  const status = run.meta.recorder.status;
  if (status === lastStatus && now - lastCheck < RUN_ACTIVITY_TIMING.checkEveryMs) return;
  lastCheck = now;
  lastStatus = status;
  // A finished run ends the activity when tracking stops.
  const state = stateFor(run, now);
  if (!state || !shouldUpdate(lastSent, state, now - lastSentAt)) return;
  lastSent = state;
  lastSentAt = now;
  void serial(() => native.update(state, RUN_ACTIVITY_TIMING.staleAfterMs));
}

/**
 * Called once at launch. Follows the run store from now on, and clears an
 * activity left on the Lock Screen by a run that's no longer in progress (the
 * app was closed mid-run and the run then saved or discarded).
 */
export function initRunActivity(): void {
  if (!native) return;
  runStore.subscribe(syncRunActivity);
  runStore
    .load()
    .then((run) => {
      const status = run?.meta.recorder.status;
      if (status !== 'countdown' && status !== 'recording' && status !== 'paused') return endRunActivity();
    })
    .catch(() => undefined);
}
