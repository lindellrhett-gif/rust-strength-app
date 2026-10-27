/**
 * Calories burned exercising on a given day, for the nutrition diary's
 * "Goal - Food + Exercise = Remaining". Pure, no I/O.
 *
 * Only activities carry calories: runs fill theirs in from distance, climb
 * and bodyweight, and other activities from what was entered. Lifting
 * sessions have no estimate yet, so they add nothing rather than a guess.
 * Whether exercise calories are added back to the day's budget at all is
 * the diary's setting, not decided here.
 */

import { activityTitle, type ActivityRecord } from './activities';

export interface ExerciseEntry {
  id: string;
  title: string;
  kind: string;
  /** Null when the activity has no estimate. */
  calories: number | null;
}

export interface ExerciseDay {
  totalCalories: number;
  entries: ExerciseEntry[];
}

/**
 * The exercise logged on `date` (local `YYYY-MM-DD`), with the calories that
 * have estimates added up. `localDate` turns a timestamp into a local date.
 */
export function exerciseCaloriesForDay(
  activities: readonly ActivityRecord[],
  date: string,
  localDate: (iso: string) => string,
): ExerciseDay {
  const entries = activities
    .filter((a) => localDate(a.performedAt) === date)
    .map((a) => ({
      id: a.id,
      title: activityTitle(a),
      kind: a.kind,
      calories: a.calories != null && Number.isFinite(a.calories) && a.calories > 0 ? Math.round(a.calories) : null,
    }));
  return { totalCalories: entries.reduce((sum, e) => sum + (e.calories ?? 0), 0), entries };
}
