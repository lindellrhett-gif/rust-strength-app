/**
 * Post-workout summary — the numbers shown on the screen that appears when a
 * session is finished, plus which lifts were personal records.
 *
 * The PR comparison itself is done in SQL (rpc_workout_summary), because only
 * the database knows the user's history before this session. This module
 * shapes those rows into what the screen renders.
 */

export interface SummaryExerciseRow {
  exerciseId: string;
  exerciseName: string;
  workingSets: number;
  volume: number;
  bestWeight: number;
  bestReps: number;
  bestE1rm: number;
  prevBestWeight: number | null;
  prevBestE1rm: number | null;
  isWeightPr: boolean;
  isE1rmPr: boolean;
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  kind: 'weight' | 'e1rm';
  value: number;
  previous: number | null;
  /** How much it beat the old mark by, or null for a first-ever record. */
  delta: number | null;
}

export interface WorkoutSummary {
  durationSeconds: number;
  totalVolume: number;
  totalReps: number;
  totalSets: number;
  exerciseCount: number;
  exercises: SummaryExerciseRow[];
  records: PersonalRecord[];
  /** True when the session had no working sets at all. */
  empty: boolean;
}

export interface SummaryTotals {
  totalVolume: number;
  totalReps: number;
  totalSets: number;
}

/**
 * A weight PR is the headline; an e1RM PR is only reported when the weight
 * itself was not a record, so one good set does not produce two near-identical
 * trophies on the same screen.
 */
export function extractRecords(rows: SummaryExerciseRow[]): PersonalRecord[] {
  const records: PersonalRecord[] = [];

  for (const r of rows) {
    if (r.bestWeight > 0 && r.isWeightPr) {
      records.push({
        exerciseId: r.exerciseId,
        exerciseName: r.exerciseName,
        kind: 'weight',
        value: r.bestWeight,
        previous: r.prevBestWeight,
        delta:
          r.prevBestWeight != null
            ? Math.round((r.bestWeight - r.prevBestWeight) * 10) / 10
            : null,
      });
    } else if (r.bestE1rm > 0 && r.isE1rmPr) {
      records.push({
        exerciseId: r.exerciseId,
        exerciseName: r.exerciseName,
        kind: 'e1rm',
        value: Math.round(r.bestE1rm * 10) / 10,
        previous: r.prevBestE1rm != null ? Math.round(r.prevBestE1rm * 10) / 10 : null,
        delta:
          r.prevBestE1rm != null
            ? Math.round((r.bestE1rm - r.prevBestE1rm) * 10) / 10
            : null,
      });
    }
  }

  // Biggest jumps first; brand-new lifts (no previous mark) lead.
  return records.sort((a, b) => {
    if (a.previous == null && b.previous != null) return -1;
    if (b.previous == null && a.previous != null) return 1;
    return (b.delta ?? 0) - (a.delta ?? 0);
  });
}

export function buildSummary(
  durationSeconds: number,
  totals: SummaryTotals,
  rows: SummaryExerciseRow[],
): WorkoutSummary {
  return {
    durationSeconds: Math.max(0, durationSeconds),
    totalVolume: Math.round(totals.totalVolume),
    totalReps: totals.totalReps,
    totalSets: totals.totalSets,
    exerciseCount: rows.length,
    exercises: rows,
    records: extractRecords(rows),
    empty: totals.totalSets === 0,
  };
}

/** A short line for the top of the screen, tuned to how the session went. */
export function summaryHeadline(summary: WorkoutSummary): string {
  if (summary.empty) return 'No sets logged';
  const prs = summary.records.length;
  if (prs >= 3) return `${prs} personal records — huge session`;
  if (prs === 2) return 'Two personal records';
  if (prs === 1) return 'New personal record';
  if (summary.totalSets >= 20) return 'Big volume day';
  return 'Session complete';
}
