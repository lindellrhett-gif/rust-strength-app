/**
 * The diary screen's numbers and words, worked out in one place so the
 * screen only lays them out. Pure, no I/O.
 */

import type { DiaryEntry, EntrySource } from './entries';
import { MAX_MEALS } from './entries';
import { energyIn, netCarbs, sumNutrients, type Nutrients } from './nutrients';
import { calorieBudget, goalFor, mealGoals, progressToward, type Budget, type NutritionGoal, type Progress } from './totals';

export interface DiaryMeal {
  /** The meal's position, as entries store it. */
  index: number;
  name: string;
  entries: DiaryEntry[];
  total: Nutrients;
  /** This meal's share of the calorie goal, when the goal splits by meal. */
  goalKcal: number | null;
}

export interface DiaryDayView {
  meals: DiaryMeal[];
  total: Nutrients;
  goal: NutritionGoal | null;
  budget: Budget;
  /** Carbs, fat and protein against the goal (empty without one). */
  macros: Progress[];
  isEmpty: boolean;
}

/**
 * A day as the diary shows it. Meals follow the person's names; an entry in
 * a meal beyond them (after renaming down from six to four, say) still shows,
 * under "Meal 5", rather than vanishing from the day.
 */
export function diaryDay(input: {
  day: string;
  entries: readonly DiaryEntry[];
  mealNames: readonly string[];
  goals: readonly NutritionGoal[];
  exerciseKcal: number;
  addExercise: boolean;
}): DiaryDayView {
  const highest = input.entries.reduce((m, e) => Math.max(m, e.meal), -1);
  const names = mealNamesFor(input.mealNames, highest);
  const goal = goalFor(input.goals, input.day);
  const perMeal = goal ? mealGoals(goal, names.length) : null;

  const meals: DiaryMeal[] = names.map((name, index) => {
    const entries = input.entries
      .filter((e) => e.meal === index)
      .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    return {
      index,
      name,
      entries,
      total: sumNutrients(entries.map((e) => e.nutrients)),
      goalKcal: perMeal ? perMeal[index] : null,
    };
  });
  const total = sumNutrients(input.entries.map((e) => e.nutrients));
  return {
    meals,
    total,
    goal,
    budget: calorieBudget(goal?.kcal ?? null, total.kcal, input.exerciseKcal, input.addExercise),
    macros: goal ? progressToward(total, { ...goal, targets: {} }) : [],
    isEmpty: input.entries.length === 0,
  };
}

/**
 * The person's meal names, with "Meal 5" and so on after them for any meal
 * up to `upTo` that has no name: an entry there still needs a heading.
 */
export function mealNamesFor(names: readonly string[], upTo: number): string[] {
  const count = Math.min(MAX_MEALS, Math.max(names.length, upTo + 1, 1));
  return Array.from({ length: count }, (_, i) => names[i] ?? `Meal ${i + 1}`);
}

// --- Words -----------------------------------------------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** "Today", "Yesterday", "Tomorrow", else "Tue, Oct 28" (with the year when it isn't this one). */
export function dayLabel(day: string, today: string): string {
  const diff = dayNumber(day) - dayNumber(today);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  const [y, m, d] = day.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const base = `${weekday}, ${MONTHS[m - 1]} ${d}`;
  return y === Number(today.slice(0, 4)) ? base : `${base}, ${y}`;
}

/** Energy as a whole number with separators: "1,840". */
export function formatEnergy(kcal: number, unit: 'kcal' | 'kj'): string {
  return energyIn(kcal, unit).toLocaleString('en-US');
}

export function energyUnitLabel(unit: 'kcal' | 'kj'): string {
  return unit === 'kj' ? 'kJ' : 'kcal';
}

/** "12 g", "3.4 g", "—" when unknown. One decimal below 10. */
export function formatGrams(g: number | null, unit = 'g'): string {
  if (g == null || !Number.isFinite(g)) return '—';
  const n = g < 10 ? Math.round(g * 10) / 10 : Math.round(g);
  return `${n} ${unit}`;
}

/** The carbs line, as the net-carbs setting wants it. */
export function carbsShown(n: Pick<Nutrients, 'carbsG' | 'fiberG'>, net: boolean): { label: string; grams: number | null } {
  return net ? { label: 'Net carbs', grams: netCarbs(n) } : { label: 'Carbs', grams: n.carbsG };
}

export const SOURCE_LABELS: Record<EntrySource, string> = {
  usda: 'USDA FoodData Central',
  off: 'Open Food Facts',
  user: 'My food',
  recipe: 'My recipe',
  quick: 'Quick add',
};

/** "Remaining" or "Over", for the budget line. */
export function remainingLabel(budget: Budget): string {
  return budget.remaining != null && budget.remaining < 0 ? 'Over' : 'Remaining';
}

/**
 * An amount as typed: "1.5", "1,5", "1/2", "1 1/2". Null for anything else,
 * zero or less.
 */
export function parseAmount(typed: string): number | null {
  const s = typed.trim().replace(',', '.');
  let value: number | null = null;
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  const fraction = /^(\d+)\/(\d+)$/.exec(s);
  if (mixed) {
    const den = Number(mixed[3]);
    value = den > 0 ? Number(mixed[1]) + Number(mixed[2]) / den : null;
  } else if (fraction) {
    const den = Number(fraction[2]);
    value = den > 0 ? Number(fraction[1]) / den : null;
  } else if (/^\d*\.?\d+$/.test(s) || /^\d+\.$/.test(s)) {
    value = Number(s);
  }
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * An optional number field: blank is null, a number zero or more is itself,
 * and anything else is NaN so the form can say so.
 */
export function parseOptionalNumber(typed: string): number | null {
  const t = typed.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
