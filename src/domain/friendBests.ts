/**
 * A friend's personal bests, read from rpc_friend_prs. On bodyweight and
 * assisted exercises the server sends reps only, marked BW, so a friend's
 * bodyweight never reaches your phone (migration 0037). Before that migration
 * those rows come with numbers and no mark, and are read as they were.
 */

export interface FriendBestRow {
  exercise_name: string | null;
  best_weight: number | null;
  best_reps: number | null;
  best_e1rm: number | null;
  /** From migration 0037. */
  bodyweight?: boolean | null;
}

export interface FriendBests {
  /** Best weight per exercise, keyed by lowercased exercise name. BW exercises are left out. */
  bestWeight: Record<string, number>;
  /** Best reps in a single set per exercise, keyed by lowercased name. */
  bestReps: Record<string, number>;
  /** Best estimated 1RM per exercise. BW exercises are left out. */
  bestE1rm: Record<string, number>;
  /** Lowercased names of exercises that are BW: reps only, never a weight. */
  bodyweight: string[];
}

export function friendBests(rows: readonly FriendBestRow[]): FriendBests {
  const bestWeight: Record<string, number> = {};
  const bestReps: Record<string, number> = {};
  const bestE1rm: Record<string, number> = {};
  const bodyweight = new Set<string>();

  for (const row of rows) {
    const key = (row.exercise_name ?? '').toLowerCase();
    if (!key) continue;
    bestReps[key] = Math.max(bestReps[key] ?? 0, Number(row.best_reps) || 0);
    if (row.bodyweight) {
      bodyweight.add(key);
      continue;
    }
    if (row.best_weight != null) bestWeight[key] = Math.max(bestWeight[key] ?? 0, Number(row.best_weight) || 0);
    if (row.best_e1rm != null) bestE1rm[key] = Math.max(bestE1rm[key] ?? 0, Number(row.best_e1rm) || 0);
  }

  // Two exercises with the same name, one of them bodyweight: no number for either.
  for (const key of bodyweight) {
    delete bestWeight[key];
    delete bestE1rm[key];
  }

  return { bestWeight, bestReps, bestE1rm, bodyweight: [...bodyweight].sort() };
}
