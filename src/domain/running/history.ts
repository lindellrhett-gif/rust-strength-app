/**
 * Running history: every run as one list, weekly and monthly totals, the
 * weekly goal, and personal records. Pure, no I/O. Dates are local
 * `YYYY-MM-DD`, and weeks start on Sunday, like the rest of the stats.
 *
 * Runs logged by hand before running existed (an activity of kind "run" with
 * no detail row) still count toward distance and history; they just have no
 * route, splits or best efforts.
 */

import { addDays, weekStart } from '../stats';
import { EFFORT_KEYS, personalRecords, type BestEfforts, type EffortKey } from './bestEfforts';
import type { RunForLoad } from './load';

export interface HistoryRun {
  id: string;
  name: string;
  /** Local date of the run. */
  date: string;
  performedAt: string;
  distanceM: number;
  movingSeconds: number;
  effort: number | null;
  /** Has a detail page: recorded, or entered since running was added. */
  detailed: boolean;
  source: 'gps' | 'manual' | 'treadmill' | null;
  efforts: BestEfforts;
}

/** An activity of kind "run" with its run detail, as the history query returns it. */
export interface HistoryRow {
  id: string;
  name: string | null;
  performed_at: string;
  distance: number | null;
  distance_unit: string | null;
  duration_seconds: number | null;
  runs: {
    distance_m: number;
    moving_seconds: number;
    source: 'gps' | 'manual' | 'treadmill';
    effort: number | null;
    run_best_efforts: { effort_key: string; seconds: number }[] | null;
  } | null;
}

const METRES_PER_UNIT: Record<string, number> = { mi: 1609.344, km: 1000, m: 1 };

/**
 * One row as a run, or null when there is no distance to count (a hand-logged
 * run with only a duration). `localDate` turns a timestamp into the device's
 * local date.
 */
export function toHistoryRun(row: HistoryRow, localDate: (iso: string) => string): HistoryRun | null {
  const detail = row.runs;
  const distanceM =
    detail?.distance_m ??
    (row.distance != null && row.distance_unit != null ? row.distance * (METRES_PER_UNIT[row.distance_unit] ?? 0) : 0);
  if (!(distanceM > 0)) return null;

  const efforts: BestEfforts = {};
  for (const e of detail?.run_best_efforts ?? []) {
    if ((EFFORT_KEYS as string[]).includes(e.effort_key) && e.seconds > 0) efforts[e.effort_key as EffortKey] = e.seconds;
  }
  return {
    id: row.id,
    name: row.name?.trim() || 'Run',
    date: localDate(row.performed_at),
    performedAt: row.performed_at,
    distanceM,
    movingSeconds: detail?.moving_seconds ?? row.duration_seconds ?? 0,
    effort: detail?.effort ?? null,
    detailed: detail != null,
    source: detail?.source ?? null,
    efforts,
  };
}

export interface PeriodTotal {
  /** The week's Sunday, or the month as `YYYY-MM`. */
  period: string;
  distanceM: number;
  runs: number;
}

/** Distance per week for the last `weeks` weeks, oldest first, this week last. */
export function weeklyTotals(runs: readonly HistoryRun[], today: string, weeks = 12): PeriodTotal[] {
  const thisWeek = weekStart(today);
  const out: PeriodTotal[] = Array.from({ length: weeks }, (_, i) => ({
    period: addDays(thisWeek, -7 * (weeks - 1 - i)),
    distanceM: 0,
    runs: 0,
  }));
  const index = new Map(out.map((w, i) => [w.period, i]));
  for (const r of runs) {
    if (r.date > today) continue;
    const i = index.get(weekStart(r.date));
    if (i == null) continue;
    out[i].distanceM += r.distanceM;
    out[i].runs += 1;
  }
  return out;
}

/** Distance per calendar month for the last `months` months, oldest first. */
export function monthlyTotals(runs: readonly HistoryRun[], today: string, months = 12): PeriodTotal[] {
  const [y, m] = today.split('-').map(Number);
  const out: PeriodTotal[] = Array.from({ length: months }, (_, i) => {
    const back = months - 1 - i;
    const total = y * 12 + (m - 1) - back;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    return { period: `${year}-${String(month).padStart(2, '0')}`, distanceM: 0, runs: 0 };
  });
  const index = new Map(out.map((p, i) => [p.period, i]));
  for (const r of runs) {
    if (r.date > today) continue;
    const i = index.get(r.date.slice(0, 7));
    if (i == null) continue;
    out[i].distanceM += r.distanceM;
    out[i].runs += 1;
  }
  return out;
}

export interface GoalProgress {
  distanceM: number;
  goalM: number;
  /** 0 to 1, capped: a goal beaten is a goal met. */
  fraction: number;
  met: boolean;
}

/** This week's distance against the weekly goal, or null without a goal. */
export function weekGoalProgress(
  runs: readonly HistoryRun[],
  today: string,
  goalM: number | null,
): GoalProgress | null {
  if (goalM == null || !(goalM > 0)) return null;
  const thisWeek = weekStart(today);
  const distanceM = runs.filter((r) => r.date >= thisWeek && r.date <= today).reduce((s, r) => s + r.distanceM, 0);
  return { distanceM, goalM, fraction: Math.min(1, distanceM / goalM), met: distanceM >= goalM };
}

export interface RunRecords {
  /** Fastest time for each standard distance, and the run it came from. */
  efforts: Partial<Record<EffortKey, { seconds: number; run: HistoryRun }>>;
  longest: HistoryRun | null;
}

export function runRecords(runs: readonly HistoryRun[]): RunRecords {
  let longest: HistoryRun | null = null;
  for (const r of runs) if (!longest || r.distanceM > longest.distanceM) longest = r;
  return { efforts: personalRecords(runs), longest };
}

/** The history in the shape the running-load summary takes. */
export function forLoad(runs: readonly HistoryRun[]): RunForLoad[] {
  return runs.map((r) => ({ date: r.date, distanceM: r.distanceM, movingSeconds: r.movingSeconds, effort: r.effort }));
}
