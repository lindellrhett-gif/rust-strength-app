/**
 * "Last time": every set from the previous session of an exercise, shown
 * while logging, with the best one picked out as the number to beat.
 */

import type { LoadType } from './loadType';

export interface SessionSet {
  workoutId: string;
  weight: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  isBodyweight: boolean;
  assistWeight: number | null;
  addedWeight: number | null;
  durationSeconds: number | null;
  performedAt: string | number | Date;
}

export interface LastTopSet {
  set: SessionSet;
  /** When that session was, from its newest set. */
  performedAt: string | number | Date;
  /** Working sets of this exercise in that session. */
  workingSets: number;
}

function toTime(v: string | number | Date): number {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Positive when `a` is the better set. What "top" means depends on the type:
 *   weighted and assisted — the heaviest load moved (least assistance), then
 *     the most reps
 *   bodyweight — the most added weight, then the most reps
 *   timed — the longest hold, then the most added weight
 */
export function compareSets(a: SessionSet, b: SessionSet, loadType: LoadType): number {
  if (loadType === 'timed') {
    return (a.durationSeconds ?? 0) - (b.durationSeconds ?? 0) || a.weight - b.weight;
  }
  if (loadType === 'bodyweight') {
    return (a.addedWeight ?? 0) - (b.addedWeight ?? 0) || a.reps - b.reps;
  }
  return a.weight - b.weight || a.reps - b.reps;
}

export interface LastSession {
  /** Every set of the exercise in that session, warm-ups included, in the order done. */
  sets: SessionSet[];
  /** Where the top working set is in `sets`. */
  topIndex: number;
  /** When that session was, from its newest set. */
  performedAt: string | number | Date;
}

/**
 * The most recent session before `currentWorkoutId` with a working set of
 * this exercise, or null when there is none. A session of only warm-ups
 * doesn't count, but the warm-ups of the session that does are listed.
 */
export function lastSession(
  history: SessionSet[],
  currentWorkoutId: string | null | undefined,
  loadType: LoadType,
): LastSession | null {
  const earlier = history.filter((s) => s.workoutId !== currentWorkoutId);
  const working = earlier.filter((s) => !s.isWarmup);
  if (working.length === 0) return null;

  const newest = working.reduce((a, b) => (toTime(b.performedAt) > toTime(a.performedAt) ? b : a));
  const sets = earlier
    .filter((s) => s.workoutId === newest.workoutId)
    .sort((a, b) => toTime(a.performedAt) - toTime(b.performedAt));

  let topIndex = -1;
  sets.forEach((s, i) => {
    if (!s.isWarmup && (topIndex < 0 || compareSets(s, sets[topIndex], loadType) > 0)) topIndex = i;
  });

  return { sets, topIndex, performedAt: sets[sets.length - 1].performedAt };
}

/** Just the top working set of the last session, with how many working sets it had. */
export function lastTopSet(
  history: SessionSet[],
  currentWorkoutId: string | null | undefined,
  loadType: LoadType,
): LastTopSet | null {
  const last = lastSession(history, currentWorkoutId, loadType);
  if (!last) return null;
  const working = last.sets.filter((s) => !s.isWarmup);
  return { set: last.sets[last.topIndex], performedAt: working[working.length - 1].performedAt, workingSets: working.length };
}
