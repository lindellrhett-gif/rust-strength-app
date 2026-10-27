/**
 * Running load: how much running someone has been doing lately, in one small
 * summary. This is the interface the lifting recommendations and the coach
 * will read later; nothing uses it to change a recommendation yet.
 * Pure, no I/O. Dates are local `YYYY-MM-DD`, like the rest of the stats.
 */

import { addDays, daysBetween, weekStart } from '../stats';

export interface RunForLoad {
  /** Local date the run happened. */
  date: string;
  distanceM: number;
  movingSeconds: number;
  /** Perceived effort 1–10, when the runner rated it. */
  effort: number | null;
}

/** Effort at or above this counts as a hard session. */
export const HARD_EFFORT = 8;
/** How many of the longest recent runs to report. */
export const LONG_RUNS_REPORTED = 3;

export interface RunningLoad {
  /** This week so far, Sunday to today. */
  weekDistanceM: number;
  last7DaysDistanceM: number;
  last7DaysMovingSeconds: number;
  runsLast7Days: number;
  hardRunsLast7Days: number;
  /** Average weekly distance over the four full weeks before this one. */
  fourWeekAverageM: number;
  /** The longest runs in the last 28 days, longest first. */
  longRunsLast28Days: { date: string; distanceM: number }[];
}

export function runningLoad(runs: readonly RunForLoad[], today: string): RunningLoad {
  const thisWeek = weekStart(today);
  const fourWeeksBack = addDays(thisWeek, -28);
  const inLast = (date: string, days: number) => {
    const ago = daysBetween(date, today);
    return ago >= 0 && ago < days;
  };

  let weekDistanceM = 0;
  let last7DaysDistanceM = 0;
  let last7DaysMovingSeconds = 0;
  let runsLast7Days = 0;
  let hardRunsLast7Days = 0;
  let priorFourWeeksM = 0;
  const recent: { date: string; distanceM: number }[] = [];

  for (const r of runs) {
    const distance = Number.isFinite(r.distanceM) && r.distanceM > 0 ? r.distanceM : 0;
    if (r.date >= thisWeek && r.date <= today) weekDistanceM += distance;
    if (inLast(r.date, 7)) {
      last7DaysDistanceM += distance;
      last7DaysMovingSeconds += Math.max(0, r.movingSeconds || 0);
      runsLast7Days += 1;
      if (r.effort != null && r.effort >= HARD_EFFORT) hardRunsLast7Days += 1;
    }
    if (r.date >= fourWeeksBack && r.date < thisWeek) priorFourWeeksM += distance;
    if (inLast(r.date, 28) && distance > 0) recent.push({ date: r.date, distanceM: distance });
  }

  recent.sort((a, b) => b.distanceM - a.distanceM || b.date.localeCompare(a.date));
  return {
    weekDistanceM,
    last7DaysDistanceM,
    last7DaysMovingSeconds,
    runsLast7Days,
    hardRunsLast7Days,
    fourWeekAverageM: priorFourWeeksM / 4,
    longRunsLast28Days: recent.slice(0, LONG_RUNS_REPORTED),
  };
}
