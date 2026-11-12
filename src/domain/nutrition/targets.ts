/**
 * Targets for the label nutrients beyond calories and macros, and how a day
 * reads against them. Pure, no I/O.
 *
 * The suggested values are the Daily Values printed on US food labels, for a
 * 2,000-calorie diet (FDA, "Daily Value on the Nutrition and Supplement Facts
 * Labels", https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels,
 * content current as of March 5, 2024). The FDA describes them as amounts
 * "to consume or not to exceed": fiber, potassium, calcium, iron and
 * vitamin D are amounts to reach, and saturated fat, sodium, added sugars and
 * cholesterol are amounts to stay under. The diary reads each one that way.
 */

import { carbsShown } from './diary';
import { NUTRIENT_KEYS, NUTRIENT_LABELS, type NutrientKey, type Nutrients } from './nutrients';
import type { NutritionGoal } from './totals';

/** The nutrients a goal can set a target for, besides calories and the three macros, in label order. */
export const TARGET_KEYS = [
  'satFatG',
  'transFatG',
  'cholesterolMg',
  'sodiumMg',
  'fiberG',
  'sugarsG',
  'addedSugarsG',
  'vitaminDMcg',
  'calciumMg',
  'ironMg',
  'potassiumMg',
] as const satisfies readonly NutrientKey[];

export type TargetKey = (typeof TARGET_KEYS)[number];

/**
 * Amounts to stay under; every other target, the three macros included, is
 * an amount to reach. Trans fat and total sugars have no Daily Value, but a
 * target someone sets for them is a limit too.
 */
export const LIMIT_KEYS: ReadonlySet<NutrientKey> = new Set<NutrientKey>([
  'satFatG',
  'transFatG',
  'cholesterolMg',
  'sodiumMg',
  'sugarsG',
  'addedSugarsG',
]);

/** The FDA Daily Values for the target nutrients that have one (trans fat and total sugars have none). */
export const DAILY_VALUES: Partial<Record<TargetKey, number>> = {
  satFatG: 20,
  cholesterolMg: 300,
  sodiumMg: 2300,
  fiberG: 28,
  addedSugarsG: 50,
  vitaminDMcg: 20,
  calciumMg: 1300,
  ironMg: 18,
  potassiumMg: 4700,
};

/** The largest target the form takes, in any unit. */
export const MAX_TARGET = 100_000;

export type TargetStatus = 'over' | 'met' | 'under';

export interface NutrientRow {
  key: NutrientKey;
  label: string;
  unit: string;
  /** Null when no food logged that day says. */
  eaten: number | null;
  target: number | null;
  /** 'limit' for an amount to stay under, 'goal' for one to reach; null without a target. */
  kind: 'limit' | 'goal' | null;
  status: TargetStatus | null;
}

/**
 * Every label nutrient for a day, in label order, with its target where the
 * goal has one. Carbs follow the net-carbs setting, as on the rest of the diary.
 */
export function nutrientRows(total: Nutrients, goal: NutritionGoal | null, net: boolean): NutrientRow[] {
  const targets: Partial<Record<NutrientKey, number>> = { ...(goal?.targets ?? {}) };
  if (goal?.proteinG != null) targets.proteinG = goal.proteinG;
  if (goal?.carbsG != null) targets.carbsG = goal.carbsG;
  if (goal?.fatG != null) targets.fatG = goal.fatG;

  return NUTRIENT_KEYS.filter((key) => key !== 'kcal').map((key) => {
    const label = key === 'carbsG' ? carbsShown(total, net).label : NUTRIENT_LABELS[key].label;
    const eaten = key === 'carbsG' ? carbsShown(total, net).grams : total[key];
    const target = targets[key] != null && targets[key]! > 0 ? targets[key]! : null;
    const kind = target == null ? null : LIMIT_KEYS.has(key) ? 'limit' : 'goal';
    let status: TargetStatus | null = null;
    if (target != null && eaten != null) {
      if (kind === 'limit') status = eaten > target ? 'over' : 'under';
      else status = eaten >= target ? 'met' : 'under';
    }
    return { key, label, unit: NUTRIENT_LABELS[key].unit, eaten, target, kind, status };
  });
}
