/**
 * Editing a finished workout: its length, its name, and the sets in it.
 * Pure, so the arithmetic can be tested without a database.
 */

import { e1rmFromSet } from './recommender';

/** Longest a session can be set to. Anything longer is a forgotten Finish. */
export const MAX_WORKOUT_SECONDS = 12 * 3600;
export const MAX_NAME_LENGTH = 60;

/** Seconds between start and end, rounded to the minute, never negative. */
export function workoutLengthSeconds(startedAt: string, endedAt: string | null): number {
  if (!endedAt) return 0;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60_000) * 60;
}

/** The end time for a session of `seconds` that began at `startedAt`. */
export function endedAtFor(startedAt: string, seconds: number): string {
  return new Date(new Date(startedAt).getTime() + seconds * 1000).toISOString();
}

/** Why a length cannot be saved, or null when it can. */
export function lengthProblem(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds < 60) return 'A workout has to be at least a minute long.';
  if (seconds > MAX_WORKOUT_SECONDS) return 'A workout can be at most 12 hours long.';
  return null;
}

/** Trimmed name, or null to leave the session unnamed. */
export function normalizeWorkoutName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

/** How a stored set was logged, read from which columns it filled in. */
export type SetKind = 'weighted' | 'assisted' | 'bodyweight' | 'timed';

export interface StoredSet {
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  assist_weight: number | null;
  added_weight: number | null;
  duration_seconds: number | null;
}

export function setKind(s: StoredSet): SetKind {
  if (s.duration_seconds != null) return 'timed';
  if (s.assist_weight != null) return 'assisted';
  if (s.added_weight != null) return 'bodyweight';
  return 'weighted';
}

/**
 * The number the user edits for a set, in the terms they logged it: the
 * weight, the assistance, the weight added on top, or the hold in seconds.
 */
export function editableValue(s: StoredSet): number {
  switch (setKind(s)) {
    case 'timed':
      return s.duration_seconds ?? 0;
    case 'assisted':
      return s.assist_weight ?? 0;
    case 'bodyweight':
      return s.added_weight ?? 0;
    case 'weighted':
      return s.weight;
  }
}

export interface SetEdit {
  value: number;
  reps: number;
}

export type SetPatch = Pick<
  StoredSet,
  'weight' | 'reps' | 'assist_weight' | 'added_weight' | 'duration_seconds'
> & { e1rm: number };

/**
 * The columns to write for an edited set.
 *
 * `weight` stays the load actually moved. The bodyweight used when the set
 * was logged is recovered from the row itself (assisted: load + assistance;
 * bodyweight: load − added), so an edit today does not quietly re-price the
 * set at today's bodyweight.
 */
export function patchForEdit(s: StoredSet, edit: SetEdit): SetPatch {
  const value = Math.max(0, round1(edit.value));
  const reps = Math.max(1, Math.round(edit.reps));
  let patch: Omit<SetPatch, 'e1rm'>;

  switch (setKind(s)) {
    case 'timed':
      patch = {
        weight: s.weight,
        reps: 1,
        assist_weight: null,
        added_weight: s.added_weight,
        duration_seconds: Math.max(1, Math.round(value)),
      };
      break;
    case 'assisted': {
      const bodyWeight = s.weight + (s.assist_weight ?? 0);
      patch = {
        weight: Math.max(0, round1(bodyWeight - value)),
        reps,
        assist_weight: value,
        added_weight: null,
        duration_seconds: null,
      };
      break;
    }
    case 'bodyweight': {
      const bodyWeight = Math.max(0, s.weight - (s.added_weight ?? 0));
      patch = {
        weight: round1(bodyWeight + value),
        reps,
        assist_weight: null,
        added_weight: value,
        duration_seconds: null,
      };
      break;
    }
    case 'weighted':
      patch = { weight: value, reps, assist_weight: null, added_weight: null, duration_seconds: null };
      break;
  }

  const e1rm = s.is_warmup
    ? 0
    : Math.round(e1rmFromSet({ weight: patch.weight, reps: patch.reps, rpe: s.rpe }) * 10) / 10;
  return { ...patch, e1rm };
}

/** Whether an edit changes anything worth writing. */
export function isChanged(s: StoredSet, edit: SetEdit): boolean {
  if (Math.abs(editableValue(s) - edit.value) > 0.001) return true;
  return setKind(s) !== 'timed' && Math.round(edit.reps) !== s.reps;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
