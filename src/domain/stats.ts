/**
 * Pure aggregation helpers for the Stats screen: streaks, all-time totals,
 * weekly whole-body coverage. All date inputs are local `YYYY-MM-DD` strings
 * (the data layer converts timestamps using the device's local date), so the
 * math here has no timezone concerns.
 */

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

// --- Date helpers (operate on 'YYYY-MM-DD') --------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toUtcMs(date: string): number {
  if (!DATE_RE.test(date)) return NaN;
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** `YYYY-MM-DD` shifted by `n` days (may be negative). */
export function addDays(date: string, n: number): string {
  const ms = toUtcMs(date);
  if (Number.isNaN(ms)) return date;
  const next = new Date(ms + n * 86_400_000);
  return next.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

function normalizeDates(dates: string[]): string[] {
  return Array.from(new Set(dates.filter((d) => DATE_RE.test(d)))).sort();
}

// --- Streaks ------------------------------------------------------------------

/**
 * Consecutive days worked out, ending today or yesterday (so the streak does
 * not "break" simply because the user has not trained yet today).
 */
export function currentStreak(
  workoutDates: string[],
  today: string,
  /** Deliberate days off. They bridge a streak rather than breaking it. */
  restDates: string[] = [],
): number {
  const trained = new Set(normalizeDates(workoutDates));
  const rested = new Set(normalizeDates(restDates));
  const counts = (d: string) => trained.has(d) || rested.has(d);
  if (trained.size === 0) return 0; // rest alone is not a streak

  let cursor: string;
  if (counts(today)) cursor = today;
  else if (counts(addDays(today, -1))) cursor = addDays(today, -1);
  else return 0;

  let streak = 0;
  let sawWorkout = false;
  while (counts(cursor)) {
    streak += 1;
    if (trained.has(cursor)) sawWorkout = true;
    cursor = addDays(cursor, -1);
  }
  // A run made only of rest days is not a streak, however long it is.
  return sawWorkout ? streak : 0;
}

/** Longest run of consecutive workout days ever. */
export function bestStreak(workoutDates: string[], restDates: string[] = []): number {
  const trained = new Set(normalizeDates(workoutDates));
  if (trained.size === 0) return 0;
  const days = normalizeDates([...workoutDates, ...restDates]);

  let best = 0;
  let run = 0;
  let runHasWorkout = false;

  const closeRun = () => {
    if (runHasWorkout) best = Math.max(best, run);
  };

  for (let i = 0; i < days.length; i += 1) {
    if (i > 0 && daysBetween(days[i - 1], days[i]) === 1) {
      run += 1;
    } else {
      closeRun();
      run = 1;
      runHasWorkout = false;
    }
    if (trained.has(days[i])) runHasWorkout = true;
  }
  closeRun();
  return best;
}

// --- All-time totals -------------------------------------------------------

export interface TotalsSetRow {
  weight: number;
  reps: number;
  workoutId: string;
}

export interface AllTimeTotals {
  /** Σ weight × reps. */
  volume: number;
  reps: number;
  sets: number;
  workouts: number;
}

/**
 * `sets` should already be scoped to completed workouts by the caller.
 * `completedWorkoutIds` counts distinct finished sessions.
 */
export function allTimeTotals(
  sets: TotalsSetRow[],
  completedWorkoutIds: Iterable<string>,
): AllTimeTotals {
  let volume = 0;
  let reps = 0;
  for (const s of sets) {
    const w = Number.isFinite(s.weight) ? s.weight : 0;
    const r = Number.isFinite(s.reps) ? s.reps : 0;
    volume += w * r;
    reps += r;
  }
  return {
    volume: Math.round(volume),
    reps,
    sets: sets.length,
    workouts: new Set(completedWorkoutIds).size,
  };
}

// --- Weekly whole-body coverage -------------------------------------------

/** Count of working sets per muscle group. Caller filters `sets` to the week. */
export function weeklyCoverage(
  sets: { muscleGroup: MuscleGroup }[],
): Record<MuscleGroup, number> {
  const counts = Object.fromEntries(
    MUSCLE_GROUPS.map((g) => [g, 0]),
  ) as Record<MuscleGroup, number>;
  for (const s of sets) {
    if (s.muscleGroup in counts) counts[s.muscleGroup] += 1;
  }
  return counts;
}

/** Muscle groups with no sets this week — the "still to hit" list. */
export function uncoveredGroups(
  coverage: Record<MuscleGroup, number>,
): MuscleGroup[] {
  return MUSCLE_GROUPS.filter((g) => (coverage[g] ?? 0) === 0);
}

/** Monday-based start of the ISO week containing `date` (`YYYY-MM-DD`). */
export function weekStart(date: string): string {
  const ms = toUtcMs(date);
  if (Number.isNaN(ms)) return date;
  const dow = new Date(ms).getUTCDay(); // 0 Sun … 6 Sat
  const backToMonday = (dow + 6) % 7;
  return addDays(date, -backToMonday);
}
