/**
 * Nutrition reports: days, weeks and averages over a stretch of the diary.
 * Pure, no I/O.
 *
 * Averages count only days with food logged. A day nobody logged is unknown,
 * not a day of eating nothing, and counting it as zero would drag every
 * average down.
 */

import { addDays, weekStart } from '../stats';

import type { DiaryEntry } from './entries';
import { NUTRIENT_KEYS, sumNutrients, type NutrientKey, type Nutrients } from './nutrients';
import { percentFromMacros, type MacroPercent } from './goals';
import { goalFor, type NutritionGoal } from './totals';

export type ReportRange = 'week' | 'month' | 'quarter';

/** How far back each range looks, today included; the quarter is 12 whole weeks. */
export const RANGE_DAYS: Record<ReportRange, number> = { week: 7, month: 30, quarter: 84 };

export const RANGE_LABELS: Record<ReportRange, string> = {
  week: '7 days',
  month: '30 days',
  quarter: '12 weeks',
};

/** The first day of a range ending today. A quarter starts on a Sunday, so its weeks are whole, as on the calendar. */
export function rangeStart(range: ReportRange, today: string): string {
  if (range === 'quarter') return addDays(weekStart(today), -7 * 11);
  return addDays(today, -(RANGE_DAYS[range] - 1));
}

export interface ReportDay {
  day: string;
  logged: boolean;
  total: Nutrients;
  /** The calorie goal in force that day, if any. */
  goalKcal: number | null;
}

/** Every day from `from` to `to`, logged or not, oldest first. */
export function reportDays(
  entries: readonly DiaryEntry[],
  goals: readonly NutritionGoal[],
  from: string,
  to: string,
): ReportDay[] {
  const byDay = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    if (e.day < from || e.day > to) continue;
    const list = byDay.get(e.day);
    if (list) list.push(e);
    else byDay.set(e.day, [e]);
  }
  const out: ReportDay[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const list = byDay.get(day) ?? [];
    out.push({
      day,
      logged: list.length > 0,
      total: sumNutrients(list.map((e) => e.nutrients)),
      goalKcal: goalFor(goals, day)?.kcal ?? null,
    });
  }
  return out;
}

export interface ReportSummary {
  days: number;
  daysLogged: number;
  /** Over the days logged; null when none were. */
  averageKcal: number | null;
  /** The average goal over the logged days that had one. */
  averageGoalKcal: number | null;
  /** Logged days with a goal that stayed at or under it. */
  daysAtOrUnderGoal: number;
  /** Logged days that had a goal. */
  daysWithGoal: number;
  /** Where the calories from carbs, protein and fat came from, in percent. */
  macroShare: MacroPercent | null;
  /**
   * Average per logged day for each nutrient some food reported; a
   * nutrient no food logged reports is left out rather than shown as zero.
   */
  averages: Partial<Record<NutrientKey, number>>;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function reportSummary(days: readonly ReportDay[]): ReportSummary {
  const logged = days.filter((d) => d.logged);
  const withGoal = logged.filter((d) => d.goalKcal != null);
  const n = logged.length;

  const averages: Partial<Record<NutrientKey, number>> = {};
  for (const key of NUTRIENT_KEYS) {
    if (n === 0) break;
    const known = logged.map((d) => d.total[key]).filter((v): v is number => v != null);
    if (known.length > 0) averages[key] = round1(known.reduce((a, b) => a + b, 0) / n);
  }

  const sum = (key: 'carbsG' | 'proteinG' | 'fatG') => logged.reduce((a, d) => a + (d.total[key] ?? 0), 0);
  const macroShare = n === 0 ? null : percentFromMacros({ carbsG: sum('carbsG'), proteinG: sum('proteinG'), fatG: sum('fatG') });

  return {
    days: days.length,
    daysLogged: n,
    averageKcal: n === 0 ? null : Math.round(logged.reduce((a, d) => a + d.total.kcal, 0) / n),
    averageGoalKcal:
      withGoal.length === 0 ? null : Math.round(withGoal.reduce((a, d) => a + (d.goalKcal ?? 0), 0) / withGoal.length),
    daysAtOrUnderGoal: withGoal.filter((d) => d.total.kcal <= (d.goalKcal ?? 0)).length,
    daysWithGoal: withGoal.length,
    macroShare,
    averages,
  };
}

export interface ReportWeek {
  /** The Sunday the week starts on. */
  week: string;
  daysLogged: number;
  /** Average calories over the days logged that week. */
  averageKcal: number | null;
  averageGoalKcal: number | null;
}

/** Days grouped into weeks, Sunday to Saturday as everywhere in the app, for the 12-week chart. */
export function reportWeeks(days: readonly ReportDay[]): ReportWeek[] {
  const weeks = new Map<string, ReportDay[]>();
  for (const d of days) {
    const key = weekStart(d.day);
    const list = weeks.get(key);
    if (list) list.push(d);
    else weeks.set(key, [d]);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, list]) => {
      const s = reportSummary(list);
      return { week, daysLogged: s.daysLogged, averageKcal: s.averageKcal, averageGoalKcal: s.averageGoalKcal };
    });
}
