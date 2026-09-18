/**
 * "Last time" — the best set from the previous session of an exercise, shown
 * while logging so there is a number to beat.
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

/**
 * The top working set from the most recent session before `currentWorkoutId`
 * that included this exercise, or null when there is none.
 */
export function lastTopSet(
  history: SessionSet[],
  currentWorkoutId: string | null | undefined,
  loadType: LoadType,
): LastTopSet | null {
  const earlier = history.filter((s) => !s.isWarmup && s.workoutId !== currentWorkoutId);
  if (earlier.length === 0) return null;

  const newest = earlier.reduce((a, b) => (toTime(b.performedAt) > toTime(a.performedAt) ? b : a));
  const session = earlier.filter((s) => s.workoutId === newest.workoutId);
  const top = session.reduce((best, s) => (compareSets(s, best, loadType) > 0 ? s : best));

  return { set: top, performedAt: newest.performedAt, workingSets: session.length };
}
