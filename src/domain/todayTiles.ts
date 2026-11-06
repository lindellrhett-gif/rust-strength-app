/**
 * The four tiles at the top of Today: consistency, steps against the daily
 * goal, calories left and the streak. Plain logic, tested in
 * __tests__/todayTiles.test.ts; the tiles themselves are
 * src/components/TodayTiles.tsx.
 */
import { energyUnitLabel, formatEnergy } from './nutrition/diary';
import type { Budget } from './nutrition/totals';

/** Where a new daily step goal starts. */
export const DEFAULT_STEP_GOAL = 10_000;
/** The step goal moves in steps of this many. */
export const STEP_GOAL_STEP = 500;
export const STEP_GOAL_MIN = 1_000;
export const STEP_GOAL_MAX = 50_000;
/** Quick picks on the step goal sheet. */
export const STEP_GOAL_PRESETS: readonly number[] = [6_000, 8_000, 10_000, 12_000];

/**
 * A step goal from storage or the stepper: whole steps of 500, within range.
 * Anything unreadable, including nothing saved yet, gives the default.
 */
export function cleanStepGoal(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_STEP_GOAL;
  const rounded = Math.round(n / STEP_GOAL_STEP) * STEP_GOAL_STEP;
  return Math.min(STEP_GOAL_MAX, Math.max(STEP_GOAL_MIN, rounded));
}

/** "10k", "7.5k": the goal beside the step count. */
export function stepGoalShort(goal: number): string {
  const thousands = Math.round(goal / 100) / 10;
  return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
}

/** How far through the goal today's steps are, 0 to 1. */
export function stepProgress(steps: number, goal: number): number {
  if (!(goal > 0) || !(steps > 0)) return 0;
  return Math.min(1, steps / goal);
}

/** Consistency (0 to 1) as a whole percentage. */
export function consistencyPercent(fraction: number): string {
  const pct = Number.isFinite(fraction) ? Math.round(Math.min(1, Math.max(0, fraction)) * 100) : 0;
  return `${pct}%`;
}

export interface CalorieTile {
  value: string;
  label: string;
  /** Past the goal: the number is how far over. */
  over: boolean;
}

/**
 * The calories tile: what's left of today's goal, the same number the food
 * diary shows (exercise counts when that setting is on), or what was eaten
 * when no goal is set.
 */
export function calorieTile(budget: Budget, unit: 'kcal' | 'kj'): CalorieTile {
  const label = energyUnitLabel(unit);
  if (budget.goal == null || budget.remaining == null) {
    return { value: formatEnergy(budget.food, unit), label: `${label} eaten today`, over: false };
  }
  const over = budget.remaining < 0;
  return {
    value: formatEnergy(Math.abs(budget.remaining), unit),
    label: `${label} ${over ? 'over' : 'left'} today`,
    over,
  };
}
