/**
 * What a run has to look like before it is saved, whether recorded, typed in
 * for a treadmill, or edited afterwards. The database enforces the same
 * limits (migrations 0015 and 0017); this gives the screen a readable reason
 * first.
 * Pure, no I/O.
 */

import type { ValidationResult } from '../activities';

export const RUN_LIMITS = {
  /** 400 km: past the longest ultras anyone logs in one go. */
  maxDistanceM: 400_000,
  /** Under two days, like every other activity. */
  maxSeconds: 86_400 * 2 - 1,
  /** Faster than 7 m/s on average (a 3:50 mile) over a whole run is a typo. */
  maxAverageSpeedMps: 7,
  titleMax: 80,
  noteMax: 2000,
  /** Five steps a second, 300 a minute: past an all-out sprint. */
  maxStepsPerSecond: 5,
} as const;

export interface RunDraft {
  distanceM: number;
  movingSeconds: number;
  /** Defaults to moving time when not known, as for a treadmill. */
  elapsedSeconds?: number | null;
  effort?: number | null;
  title?: string | null;
  note?: string | null;
}

export function validateRun(draft: RunDraft): ValidationResult {
  const { distanceM, movingSeconds } = draft;
  const elapsed = draft.elapsedSeconds ?? movingSeconds;

  if (!Number.isFinite(distanceM) || distanceM <= 0) {
    return { ok: false, error: 'Add how far you ran.' };
  }
  if (distanceM > RUN_LIMITS.maxDistanceM) {
    return { ok: false, error: 'That distance is longer than 400 km.' };
  }
  if (!Number.isFinite(movingSeconds) || movingSeconds <= 0) {
    return { ok: false, error: 'Add how long the run took.' };
  }
  if (movingSeconds > RUN_LIMITS.maxSeconds || elapsed > RUN_LIMITS.maxSeconds) {
    return { ok: false, error: 'That time is longer than two days.' };
  }
  if (!Number.isFinite(elapsed) || elapsed < movingSeconds) {
    return { ok: false, error: 'Total time can’t be shorter than moving time.' };
  }
  if (distanceM / movingSeconds > RUN_LIMITS.maxAverageSpeedMps) {
    return { ok: false, error: 'That pace is faster than a world record. Check the distance and time.' };
  }
  if (draft.effort != null && !(Number.isInteger(draft.effort) && draft.effort >= 1 && draft.effort <= 10)) {
    return { ok: false, error: 'Effort is a whole number from 1 to 10.' };
  }
  if ((draft.title ?? '').trim().length > RUN_LIMITS.titleMax) {
    return { ok: false, error: `Keep the title under ${RUN_LIMITS.titleMax} characters.` };
  }
  if ((draft.note ?? '').length > RUN_LIMITS.noteMax) {
    return { ok: false, error: `Keep notes under ${RUN_LIMITS.noteMax} characters.` };
  }
  return { ok: true, error: null };
}
