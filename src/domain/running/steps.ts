/**
 * Steps and cadence for runs. Pure, no I/O: the phone's pedometer is read in
 * src/lib/steps.ts.
 */

import { RUN_LIMITS } from './validate';

/**
 * Average cadence in steps per minute of moving time, or null when there is
 * nothing sensible to show: no steps, under half a minute of moving, or a
 * number no runner could manage.
 */
export function cadence(steps: number | null | undefined, movingSeconds: number): number | null {
  if (steps == null || !(steps > 0) || !(movingSeconds >= 30)) return null;
  const spm = Math.round(steps / (movingSeconds / 60));
  return spm <= RUN_LIMITS.maxStepsPerSecond * 60 ? spm : null;
}

/**
 * A step count fit to save with a run, or null: a whole number, not
 * negative, and possible in the time (the database applies the same limit).
 */
export function plausibleSteps(steps: number | null | undefined, elapsedSeconds: number): number | null {
  if (steps == null || !Number.isFinite(steps) || steps < 0) return null;
  const whole = Math.round(steps);
  return whole <= Math.max(elapsedSeconds, 60) * RUN_LIMITS.maxStepsPerSecond ? whole : null;
}
