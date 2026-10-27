/**
 * What the Lock Screen and the Dynamic Island show while a run records (an
 * iOS Live Activity), and when a change is worth sending to iOS.
 *
 * iOS draws the running clock itself from the moment it read 0:00, so the
 * activity doesn't need updating every second. It is updated when the clock
 * stops or starts, when the distance moves on, when the pace changes (less
 * often, since it wobbles), and once a minute regardless. That last one
 * matters: each update says how long it stays fresh, so if the app is closed
 * mid-run the Lock Screen soon says it has stopped updating instead of
 * showing a clock that keeps counting.
 */
import { formatClock } from '../duration';

import type { RecorderState } from './recorder';
import type { LiveStats } from './summarize';
import { formatPaceValue, toUnit, type RunDistanceUnit } from './units';

export type RunActivityStatus = 'starting' | 'recording' | 'paused' | 'auto-paused';

export interface RunActivityState {
  status: RunActivityStatus;
  /**
   * When the moving clock read 0:00 (epoch ms), while it is running. Null
   * while it is still: counting down, paused, or held at a stop.
   */
  clockStart: number | null;
  /** The moving time, shown as it is while the clock is still. */
  time: string;
  /** "3.12" */
  distance: string;
  /** Average pace per mile or kilometre: "8:05", or "--:--". */
  pace: string;
  unit: RunDistanceUnit;
}

export const RUN_ACTIVITY_TIMING = {
  /** The numbers are worked out at most this often. */
  checkEveryMs: 5_000,
  /** A pace change alone waits at least this long. */
  paceEveryMs: 15_000,
  /** An update at least this often, to keep the activity fresh. */
  heartbeatMs: 60_000,
  /** After this long without an update, the Lock Screen says so. */
  staleAfterMs: 150_000,
  /** The clock's start can move by this much before it's worth correcting. */
  clockDriftMs: 2_000,
} as const;

/**
 * The activity for a run in progress, or null for a run that's finished (or
 * not started), which shows nothing.
 */
export function runActivityState(
  recorder: RecorderState,
  live: LiveStats | null,
  unit: RunDistanceUnit,
  now: number,
): RunActivityState | null {
  const { status } = recorder;
  if (status !== 'countdown' && status !== 'recording' && status !== 'paused') return null;

  const moving = Math.max(0, Math.floor(live?.movingSeconds ?? 0));
  const shown: RunActivityStatus =
    status === 'countdown'
      ? 'starting'
      : status === 'paused'
        ? 'paused'
        : live?.autoPaused
          ? 'auto-paused'
          : 'recording';
  const ticking = status === 'recording' && !(live?.holding ?? false);

  return {
    status: shown,
    clockStart: ticking ? now - moving * 1000 : null,
    time: formatClock(moving),
    distance: toUnit(Math.max(0, live?.distanceM ?? 0), unit).toFixed(2),
    pace: formatPaceValue(live?.averagePace ?? null),
    unit,
  };
}

/** Whether `next` is worth sending, given what was last sent and how long ago. */
export function shouldUpdate(prev: RunActivityState | null, next: RunActivityState, sinceSentMs: number): boolean {
  if (!prev) return true;
  if (prev.status !== next.status || prev.unit !== next.unit) return true;
  if ((prev.clockStart == null) !== (next.clockStart == null)) return true;
  if (prev.clockStart == null ? prev.time !== next.time : Math.abs(prev.clockStart - next.clockStart!) > RUN_ACTIVITY_TIMING.clockDriftMs) {
    return true;
  }
  if (prev.distance !== next.distance) return true;
  if (prev.pace !== next.pace && sinceSentMs >= RUN_ACTIVITY_TIMING.paceEveryMs) return true;
  return sinceSentMs >= RUN_ACTIVITY_TIMING.heartbeatMs;
}
