/**
 * A day's numbers: meal and day totals, the calorie budget, and progress on
 * each goal. Pure, no I/O.
 *
 * The budget is "Goal - Food + Exercise = Remaining", with exercise from
 * src/domain/exercise.ts, added only when the person's setting says so.
 */

import type { DiaryEntry } from './entries';
import { MAX_MEALS } from './entries';
import { sumNutrients, type NutrientKey, type Nutrients } from './nutrients';

/** The totals for each meal, in meal order, `mealCount` long. */
export function mealTotals(entries: readonly DiaryEntry[], mealCount: number): Nutrients[] {
  const count = Math.min(Math.max(Math.trunc(mealCount) || 1, 1), MAX_MEALS);
  return Array.from({ length: count }, (_, meal) =>
    sumNutrients(entries.filter((e) => e.meal === meal).map((e) => e.nutrients)));
}

export function dayTotal(entries: readonly DiaryEntry[]): Nutrients {
  return sumNutrients(entries.map((e) => e.nutrients));
}

export interface Budget {
  /** Null when no goal is set; the diary still shows what was eaten. */
  goal: number | null;
  food: number;
  /** Counted toward the budget: zero when the setting is off. */
  exercise: number;
  /** Negative when over. Null without a goal. */
  remaining: number | null;
}

export function calorieBudget(
  goalKcal: number | null,
  foodKcal: number,
  exerciseKcal: number,
  addExercise: boolean,
): Budget {
  const food = Math.round(foodKcal);
  const exercise = addExercise ? Math.round(Math.max(0, exerciseKcal)) : 0;
  const goal = goalKcal == null ? null : Math.round(goalKcal);
  return { goal, food, exercise, remaining: goal == null ? null : goal - food + exercise };
}

export interface NutritionGoal {
  /** Local date the goal applies from, YYYY-MM-DD. */
  startsOn: string;
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** Other targets, keyed like Nutrients. */
  targets: Partial<Record<NutrientKey, number>>;
  /** Share of the day's calories per meal, in meal order, or null for none. */
  mealSplit: number[] | null;
  /** How the macros were set; grams are stored either way. */
  macroMode?: 'percent' | 'grams';
}

/** The goal in force on `day`: the latest one starting on or before it. */
export function goalFor<G extends { startsOn: string }>(goals: readonly G[], day: string): G | null {
  let best: G | null = null;
  for (const g of goals) {
    if (g.startsOn <= day && (best == null || g.startsOn > best.startsOn)) best = g;
  }
  return best;
}

export interface Progress {
  key: NutrientKey;
  eaten: number | null;
  target: number;
  /** 0 to 1 and beyond; null when nothing is known yet. */
  fraction: number | null;
}

/** Progress on every nutrient the goal has a target for, macros first. */
export function progressToward(total: Nutrients, goal: NutritionGoal): Progress[] {
  const targets: Partial<Record<NutrientKey, number>> = { ...goal.targets };
  if (goal.proteinG != null) targets.proteinG = goal.proteinG;
  if (goal.carbsG != null) targets.carbsG = goal.carbsG;
  if (goal.fatG != null) targets.fatG = goal.fatG;
  const order: NutrientKey[] = ['carbsG', 'fatG', 'proteinG'];
  const keys = [
    ...order.filter((k) => targets[k] != null),
    ...(Object.keys(targets) as NutrientKey[]).filter((k) => !order.includes(k) && k !== 'kcal'),
  ];
  return keys.map((key) => {
    const target = targets[key] as number;
    const eaten = total[key];
    return { key, eaten, target, fraction: eaten == null || !(target > 0) ? null : eaten / target };
  });
}

/** Each meal's share of the calorie goal, when the goal splits by meal. */
export function mealGoals(goal: Pick<NutritionGoal, 'kcal' | 'mealSplit'>, mealCount: number): number[] | null {
  const split = goal.mealSplit;
  if (!split || split.length !== mealCount) return null;
  const sum = split.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (!(sum > 0)) return null;
  return split.map((share) => Math.round((goal.kcal * Math.max(0, share)) / sum));
}
