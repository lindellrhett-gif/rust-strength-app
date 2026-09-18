/**
 * Groups the sets of a workout by exercise so five sets of bench press show as
 * one block instead of five loose rows.
 *
 * Consecutive runs of the same exercise collapse into one group. If the user
 * comes back to an exercise later in the session (a superset, or a second
 * wave), that becomes a separate group and is labelled as such — merging them
 * would misrepresent the order the work was actually done in.
 */

export interface GroupableSet {
  id: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  isBodyweight: boolean;
  /** Assisted sets: the assistance entered. `weight` is the load moved. */
  assistWeight?: number | null;
  /** Bodyweight sets: weight added on top. */
  addedWeight?: number | null;
  /** Timed sets: the hold, in seconds. Such a set has reps = 1. */
  durationSeconds?: number | null;
  e1rm: number;
  orderIndex: number;
}

export interface SetGroup {
  key: string;
  exerciseId: string;
  exerciseName: string;
  sets: GroupableSet[];
  /** 1-based: "Bench Press (2nd block)" when the user returns to a movement. */
  occurrence: number;
  totalOccurrences: number;
  /** Σ weight × reps across working sets in this group. */
  volume: number;
  workingSets: number;
  /** Best e1RM among the working sets, or null if none. */
  bestE1rm: number | null;
}

export function groupSetsByExercise(sets: GroupableSet[]): SetGroup[] {
  const ordered = [...sets].sort((a, b) => a.orderIndex - b.orderIndex);
  const groups: SetGroup[] = [];

  for (const set of ordered) {
    const last = groups[groups.length - 1];
    if (last && last.exerciseId === set.exerciseId) {
      last.sets.push(set);
    } else {
      groups.push({
        key: `${set.exerciseId}-${groups.length}`,
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        sets: [set],
        occurrence: 1,
        totalOccurrences: 1,
        volume: 0,
        workingSets: 0,
        bestE1rm: null,
      });
    }
  }

  // Number repeat visits to the same exercise.
  const seen = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const g of groups) totals.set(g.exerciseId, (totals.get(g.exerciseId) ?? 0) + 1);

  for (const g of groups) {
    const n = (seen.get(g.exerciseId) ?? 0) + 1;
    seen.set(g.exerciseId, n);
    g.occurrence = n;
    g.totalOccurrences = totals.get(g.exerciseId) ?? 1;

    let volume = 0;
    let working = 0;
    let best: number | null = null;
    for (const s of g.sets) {
      if (s.isWarmup) continue;
      working += 1;
      volume += s.weight * s.reps;
      if (best == null || s.e1rm > best) best = s.e1rm;
    }
    g.volume = Math.round(volume);
    g.workingSets = working;
    g.bestE1rm = best;
  }

  return groups;
}

/** Total volume across every working set, for the session header. */
export function totalVolume(sets: GroupableSet[]): number {
  return Math.round(
    sets.reduce((sum, s) => (s.isWarmup ? sum : sum + s.weight * s.reps), 0),
  );
}
