/**
 * The goal screen's form: what was typed, checked and turned into a dated
 * goal. Pure, no I/O.
 *
 * Calories come from the calculator (goals.ts) or a number of the person's
 * own. The guardrails decided for 1.2 apply to both:
 *   - Nobody under 18 gets a weight-loss goal. Without a birthday the age
 *     can be a year high, so the lower age is used. Under 18 the calories
 *     come from the calculator, to maintain or gain, and a goal weight below
 *     the current one is refused.
 *   - A goal below the calorie floor is allowed, with a warning.
 *   - Below MIN_GOAL_KCAL nothing is saved: that is a typo or a rate too fast
 *     for the body it is meant for, and the form says which.
 * The birth year is always asked for, since the age rule depends on it.
 */

import { energyIn, KJ_PER_KCAL, NUTRIENT_LABELS } from './nutrients';
import {
  ACTIVITY_FACTORS,
  ADULT_AGE,
  ageFromBirthYear,
  CALORIE_FLOOR,
  calorieGoal,
  isBelowFloor,
  macrosFromPercent,
  MAX_WEEKLY_CHANGE_KG,
  percentFromMacros,
  type ActivityLevel,
  type CalorieGoal,
  type MacroGrams,
  type SexForCalculator,
} from './goals';
import { feetInches, LB_PER_KG, parseHeight, parseWeight, weightIn, type WeightUnit } from './body';
import type { NutritionSettings } from './settings';
import { MAX_TARGET, TARGET_KEYS, type TargetKey } from './targets';
import type { NutritionGoal } from './totals';

export type GoalDirection = 'lose' | 'maintain' | 'gain';

export interface GoalDraft {
  calories: 'calculator' | 'manual';
  /** Today's weight, in the person's unit. */
  weight: string;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  birthYear: string;
  sex: SexForCalculator | null;
  activity: ActivityLevel | null;
  direction: GoalDirection;
  /** The weekly change chosen, in kg, always positive; `direction` gives the sign. */
  rateKg: number;
  /** Optional, in the person's unit. */
  goalWeight: string;
  /** In the person's energy unit. */
  manualEnergy: string;
  macroMode: 'percent' | 'grams';
  carbsPct: string;
  proteinPct: string;
  fatPct: string;
  carbsG: string;
  proteinG: string;
  fatG: string;
  targets: Partial<Record<TargetKey, string>>;
  splitByMeal: boolean;
  /** Percent of the day's calories per meal, in meal order. */
  mealSplit: string[];
}

export interface GoalContext {
  weightUnit: WeightUnit;
  energyUnit: 'kcal' | 'kj';
  /** Local date, YYYY-MM-DD. The goal starts on it. */
  today: string;
  mealNames: readonly string[];
  /** The latest weigh-in, or the profile's bodyweight, in kg. */
  currentWeightKg: number | null;
}

/** The weekly rates offered, in the person's unit. */
export const RATE_OPTIONS: Record<WeightUnit, { label: string; kg: number }[]> = {
  lb: [0.5, 1, 1.5, 2].map((lb) => ({ label: `${lb} lb`, kg: Math.round((lb / LB_PER_KG) * 1000) / 1000 })),
  kg: [0.25, 0.5, 0.75, 1].map((kg) => ({ label: `${kg} kg`, kg })),
};

/** No goal below this is saved, from the calculator or typed in. */
export const MIN_GOAL_KCAL = 800;
export const MAX_GOAL_KCAL = 10_000;

/** The youngest age the app is for (the sign-up age check), and the oldest the calculator takes. */
export const MIN_AGE = 13;
export const MAX_AGE = 120;

/** Carbs, protein, fat: the split the form starts from. */
export const DEFAULT_MACRO_PERCENT = { carbsPct: 50, proteinPct: 20, fatPct: 30 } as const;

/** Whole percents that add up to 100, as even as they can be: 4 meals are 25 each, 3 are 34, 33, 33. */
export function evenSplit(count: number): number[] {
  const n = Math.max(1, Math.trunc(count) || 1);
  const base = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => base + (i < 100 - base * n ? 1 : 0));
}

const str = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '' : String(n));

function nearestRate(unit: WeightUnit, kg: number | null): number {
  const options = RATE_OPTIONS[unit];
  const target = kg == null || kg === 0 ? options[1].kg : Math.abs(kg);
  return options.reduce((best, o) => (Math.abs(o.kg - target) < Math.abs(best.kg - target) ? o : best)).kg;
}

/** The form as it opens: from the saved inputs and the goal in force today, or sensible blanks. */
export function draftFor(settings: NutritionSettings, goal: NutritionGoal | null, ctx: GoalContext): GoalDraft {
  const unit = ctx.weightUnit;
  const height = settings.heightCm;
  const ft = height != null ? feetInches(height) : null;
  const change = settings.weeklyChangeKg;
  const direction: GoalDirection = change == null || change === 0 ? 'maintain' : change < 0 ? 'lose' : 'gain';

  // Was the goal the calculator's? Worked out again from the same inputs, it would match.
  let calories: GoalDraft['calories'] = 'calculator';
  if (goal) {
    const again =
      ctx.currentWeightKg != null && height != null && settings.birthYear != null && settings.activity != null
        ? calorieGoal({
            weightKg: ctx.currentWeightKg,
            heightCm: height,
            birthYear: settings.birthYear,
            sex: settings.sex,
            activity: settings.activity,
            weeklyChangeKg: change ?? 0,
            today: ctx.today,
          })
        : null;
    const minor = settings.birthYear != null && ageFromBirthYear(settings.birthYear, ctx.today, true) < ADULT_AGE;
    if (!minor && (!again || Math.abs(again.kcal - goal.kcal) > 1)) calories = 'manual';
  }

  const macroMode = goal?.macroMode ?? 'percent';
  const grams = goal && goal.proteinG != null && goal.carbsG != null && goal.fatG != null
    ? { proteinG: goal.proteinG, carbsG: goal.carbsG, fatG: goal.fatG }
    : null;
  const pct = (grams && percentFromMacros(grams)) ?? DEFAULT_MACRO_PERCENT;

  const meals = ctx.mealNames.length;
  const split = goal?.mealSplit && goal.mealSplit.length === meals ? goal.mealSplit : null;

  const targets: Partial<Record<TargetKey, string>> = {};
  for (const key of TARGET_KEYS) targets[key] = str(goal?.targets[key]);

  return {
    calories,
    weight: ctx.currentWeightKg != null ? String(weightIn(ctx.currentWeightKg, unit)) : '',
    heightCm: str(height != null ? Math.round(height) : null),
    heightFt: str(ft?.feet),
    heightIn: str(ft?.inches),
    birthYear: str(settings.birthYear),
    sex: settings.sex,
    activity: settings.activity,
    direction,
    rateKg: nearestRate(unit, change),
    goalWeight: settings.goalWeightKg != null ? String(weightIn(settings.goalWeightKg, unit)) : '',
    manualEnergy: goal ? String(energyIn(goal.kcal, ctx.energyUnit)) : '',
    macroMode,
    carbsPct: String(pct.carbsPct),
    proteinPct: String(pct.proteinPct),
    fatPct: String(pct.fatPct),
    carbsG: str(goal?.carbsG != null ? Math.round(goal.carbsG) : null),
    proteinG: str(goal?.proteinG != null ? Math.round(goal.proteinG) : null),
    fatG: str(goal?.fatG != null ? Math.round(goal.fatG) : null),
    targets,
    splitByMeal: split != null,
    mealSplit: (split ?? evenSplit(meals)).map(String),
  };
}

export type GoalField =
  | 'weight'
  | 'height'
  | 'birthYear'
  | 'activity'
  | 'direction'
  | 'manualEnergy'
  | 'goalWeight'
  | 'macros'
  | 'mealSplit'
  | TargetKey;

export interface GoalProblem {
  field: GoalField;
  message: string;
}

export interface GoalResult {
  goal: NutritionGoal;
  macroMode: 'percent' | 'grams';
  /** The calculator inputs to keep, for next time. */
  settings: Partial<NutritionSettings>;
  /** Today's weight, when it was typed and differs from the latest one. */
  weighInKg: number | null;
}

export interface GoalEvaluation {
  problems: GoalProblem[];
  /** The calculator's answer, once its inputs are complete. */
  calc: CalorieGoal | null;
  /** The calorie goal as it stands, in kcal. */
  kcal: number | null;
  /** Under 18 by the birth year typed. */
  minor: boolean;
  floor: number;
  belowFloor: boolean;
  /** The grams the goal would store. */
  macros: MacroGrams | null;
  /** What those grams add up to, in kcal. */
  macroKcal: number | null;
  /** The percent fields added up, in percent mode. */
  percentTotal: number | null;
  /** The meal split added up, when splitting by meal. */
  splitTotal: number | null;
  /** Null while there are problems. */
  result: GoalResult | null;
}

/** A whole number as typed; NaN for anything else. Blank is null. */
function typedInt(typed: string): number | null {
  const t = typed.trim();
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

/** A number zero or more as typed, commas for decimals too; NaN for anything else. Blank is null. */
function typedAmount(typed: string): number | null {
  const t = typed.trim().replace(',', '.');
  if (t === '') return null;
  return /^\d*\.?\d+$|^\d+\.$/.test(t) ? Number(t) : NaN;
}

const kcalWords = (kcal: number, unit: 'kcal' | 'kj') =>
  `${energyIn(kcal, unit).toLocaleString('en-US')} ${unit === 'kj' ? 'kJ' : 'kcal'}`;

/** Everything the screen shows as the form is filled in, and the goal to save once it is right. */
export function evaluateGoal(draft: GoalDraft, ctx: GoalContext): GoalEvaluation {
  const problems: GoalProblem[] = [];
  const unit = ctx.weightUnit;
  const year = Number(ctx.today.slice(0, 4));

  // Birth year, and with it the age rule.
  const birthYear = typedInt(draft.birthYear);
  const earliestYear = year - MAX_AGE;
  const latestYear = year - MIN_AGE;
  const birthOk = birthYear != null && Number.isInteger(birthYear) && birthYear >= earliestYear && birthYear <= latestYear;
  if (!birthOk) {
    problems.push({
      field: 'birthYear',
      message: birthYear == null ? 'Enter the year you were born.' : `Enter a year from ${earliestYear} to ${latestYear}.`,
    });
  }
  const minor = birthOk && ageFromBirthYear(birthYear, ctx.today, true) < ADULT_AGE;

  // Calories.
  let calc: CalorieGoal | null = null;
  let kcal: number | null = null;
  let weightKg: number | null = null;
  let heightCm: number | null = null;
  const change = draft.direction === 'maintain' ? 0 : (draft.direction === 'lose' ? -1 : 1) * Math.min(Math.abs(draft.rateKg), MAX_WEEKLY_CHANGE_KG);

  if (draft.calories === 'calculator') {
    weightKg = parseWeight(draft.weight, unit);
    if (weightKg == null) problems.push({ field: 'weight', message: 'Enter your weight today.' });
    heightCm = unit === 'lb' ? parseHeight({ feet: draft.heightFt, inches: draft.heightIn }) : parseHeight({ cm: draft.heightCm });
    if (heightCm == null) problems.push({ field: 'height', message: 'Enter your height.' });
    if (draft.activity == null || !(draft.activity in ACTIVITY_FACTORS)) {
      problems.push({ field: 'activity', message: 'Choose how active your days are.' });
    }
    if (minor && draft.direction === 'lose') {
      problems.push({ field: 'direction', message: 'Weight-loss goals are for adults. Choose maintain or gain.' });
    }
    if (weightKg != null && heightCm != null && birthOk && draft.activity != null) {
      calc = calorieGoal({
        weightKg,
        heightCm,
        birthYear,
        sex: draft.sex,
        activity: draft.activity,
        weeklyChangeKg: minor && change < 0 ? 0 : change,
        today: ctx.today,
      });
      kcal = calc?.kcal ?? null;
      if (!calc) {
        problems.push({ field: 'weight', message: 'The calculator can’t work with these numbers. Check them, or set your own goal.' });
      } else if (calc.kcal < MIN_GOAL_KCAL) {
        problems.push({
          field: 'direction',
          message: `That rate would put your goal under ${kcalWords(MIN_GOAL_KCAL, ctx.energyUnit)} a day. Choose a slower one.`,
        });
      }
    }
  } else {
    if (minor) {
      problems.push({ field: 'manualEnergy', message: 'Under 18, the goal comes from the calculator, to maintain or gain.' });
    }
    const typed = typedAmount(draft.manualEnergy);
    const asKcal = typed == null || Number.isNaN(typed) ? null : Math.round(ctx.energyUnit === 'kj' ? typed / KJ_PER_KCAL : typed);
    if (asKcal == null || asKcal < MIN_GOAL_KCAL || asKcal > MAX_GOAL_KCAL) {
      problems.push({
        field: 'manualEnergy',
        message: `Enter a goal from ${kcalWords(MIN_GOAL_KCAL, ctx.energyUnit)} to ${kcalWords(MAX_GOAL_KCAL, ctx.energyUnit)} a day.`,
      });
    } else {
      kcal = asKcal;
    }
  }

  // Goal weight, optional.
  let goalWeightKg: number | null = null;
  if (draft.goalWeight.trim() !== '') {
    goalWeightKg = parseWeight(draft.goalWeight, unit);
    if (goalWeightKg == null) {
      problems.push({ field: 'goalWeight', message: 'Enter a goal weight, or leave it blank.' });
    } else {
      const current = weightKg ?? ctx.currentWeightKg;
      if (minor && current != null && goalWeightKg < current - 0.05) {
        problems.push({ field: 'goalWeight', message: 'Weight-loss goals are for adults. Leave this blank or set it at or above today’s weight.' });
      }
    }
  }

  // Macros.
  let macros: MacroGrams | null = null;
  let percentTotal: number | null = null;
  let grams: { proteinG: number | null; carbsG: number | null; fatG: number | null } = { proteinG: null, carbsG: null, fatG: null };
  if (draft.macroMode === 'percent') {
    const parts = [draft.carbsPct, draft.proteinPct, draft.fatPct].map(typedInt);
    if (parts.some((p) => p == null || Number.isNaN(p) || p > 100)) {
      problems.push({ field: 'macros', message: 'Enter a whole percent for each, from 0 to 100.' });
    } else {
      const [carbsPct, proteinPct, fatPct] = parts as number[];
      percentTotal = carbsPct + proteinPct + fatPct;
      if (percentTotal !== 100) {
        problems.push({ field: 'macros', message: `These add up to ${percentTotal}%. Make them 100%.` });
      } else if (kcal != null) {
        macros = macrosFromPercent(kcal, { carbsPct, proteinPct, fatPct });
        if (macros) grams = macros;
      }
    }
  } else {
    const parts = [draft.carbsG, draft.proteinG, draft.fatG].map(typedAmount);
    if (parts.some((p) => p != null && (Number.isNaN(p) || p > 2000))) {
      problems.push({ field: 'macros', message: 'Enter grams from 0 to 2,000, or leave one blank.' });
    } else {
      const [carbsG, proteinG, fatG] = parts;
      grams = { carbsG, proteinG, fatG };
      if (carbsG != null && proteinG != null && fatG != null) macros = { carbsG, proteinG, fatG };
    }
  }
  const macroKcal =
    grams.carbsG == null && grams.proteinG == null && grams.fatG == null
      ? null
      : Math.round((grams.carbsG ?? 0) * 4 + (grams.proteinG ?? 0) * 4 + (grams.fatG ?? 0) * 9);

  // Other targets, optional.
  const targets: Partial<Record<TargetKey, number>> = {};
  for (const key of TARGET_KEYS) {
    const value = typedAmount(draft.targets[key] ?? '');
    if (value == null) continue;
    if (Number.isNaN(value) || value > MAX_TARGET) {
      problems.push({ field: key, message: `Enter ${NUTRIENT_LABELS[key].unit}, or leave it blank.` });
    } else if (value > 0) {
      targets[key] = value;
    }
  }

  // Calories by meal, optional.
  let mealSplit: number[] | null = null;
  let splitTotal: number | null = null;
  if (draft.splitByMeal) {
    const shares = ctx.mealNames.map((_, i) => typedInt(draft.mealSplit[i] ?? ''));
    if (shares.some((p) => p == null || Number.isNaN(p) || p > 100)) {
      problems.push({ field: 'mealSplit', message: 'Enter a whole percent for each meal.' });
    } else {
      splitTotal = (shares as number[]).reduce((a, b) => a + b, 0);
      if (splitTotal !== 100) problems.push({ field: 'mealSplit', message: `These add up to ${splitTotal}%. Make them 100%.` });
      else mealSplit = shares as number[];
    }
  }

  const floor = CALORIE_FLOOR[draft.sex ?? 'unspecified'];
  const belowFloor = kcal != null && isBelowFloor(kcal, draft.sex);

  let result: GoalResult | null = null;
  if (problems.length === 0 && kcal != null && birthOk) {
    const settings: Partial<NutritionSettings> = { birthYear, goalWeightKg };
    if (draft.calories === 'calculator') {
      Object.assign(settings, {
        heightCm,
        sex: draft.sex,
        activity: draft.activity,
        weeklyChangeKg: calc ? calc.weeklyChangeKg : change,
      });
    }
    const typedWeight = draft.calories === 'calculator' ? weightKg : null;
    const weighInKg =
      typedWeight != null && (ctx.currentWeightKg == null || weightIn(typedWeight, unit) !== weightIn(ctx.currentWeightKg, unit))
        ? Math.round(typedWeight * 100) / 100
        : null;
    result = {
      goal: {
        startsOn: ctx.today,
        kcal,
        proteinG: grams.proteinG,
        carbsG: grams.carbsG,
        fatG: grams.fatG,
        targets,
        mealSplit,
        macroMode: draft.macroMode,
      },
      macroMode: draft.macroMode,
      settings,
      weighInKg,
    };
  }

  return { problems, calc, kcal, minor, floor, belowFloor, macros, macroKcal, percentTotal, splitTotal, result };
}
