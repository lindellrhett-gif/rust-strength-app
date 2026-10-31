/**
 * A food, the units it can be measured in, and what an amount of it is worth.
 * Pure, no I/O.
 *
 * A food's nutrients are given per its basis: per 100 g (USDA, most labels),
 * per 100 ml (drinks), or per serving (a label read as "1 bar", or a recipe).
 * Every amount someone logs comes down to a factor on that basis.
 */

import { scaleNutrients, type Nutrients } from './nutrients';

export type FoodBasis = '100g' | '100ml' | 'serving';
export type FoodSource = 'usda' | 'off' | 'user' | 'recipe';

export interface Portion {
  label: string;
  grams: number;
}

export interface Food {
  /** Null for an Open Food Facts product that hasn't been saved as a food. */
  id: string | null;
  source: FoodSource;
  barcode: string | null;
  name: string;
  brand: string | null;
  basis: FoodBasis;
  /** "1 bar", "1 can (330 ml)". Required for a per-serving food. */
  servingLabel: string | null;
  servingG: number | null;
  servingMl: number | null;
  /** Per the basis. */
  nutrients: Nutrients;
  /** Household measures in grams: "1 cup, sliced", "1 medium". */
  portions: Portion[];
}

export const GRAMS_PER_OZ = 28.349_523_125;
export const ML_PER_FL_OZ = 29.573_529_562_5;

/** One way to measure a food, as the picker offers it. */
export interface FoodUnit {
  key: string;
  /** What the entry stores and shows: "g", "oz", "1 cup, sliced". */
  label: string;
  /** Grams in one of these, when it has a weight. */
  grams: number | null;
  /** The factor on the food's basis for one of these. */
  factor: number;
}

const SERVING_KEY = 'serving';
const portionKey = (label: string) => `portion:${label}`;

/**
 * The units a food can be logged in, most natural first: its household
 * portions, then its serving, then weight or volume.
 */
export function unitsFor(food: Food): FoodUnit[] {
  const units: FoodUnit[] = [];
  const servingLabel = food.servingLabel?.trim() || 'serving';

  if (food.basis === '100g') {
    for (const p of food.portions) {
      units.push({ key: portionKey(p.label), label: p.label, grams: p.grams, factor: p.grams / 100 });
    }
    if (food.servingG) {
      units.push({ key: SERVING_KEY, label: servingLabel, grams: food.servingG, factor: food.servingG / 100 });
    }
    units.push({ key: 'g', label: 'g', grams: 1, factor: 1 / 100 });
    units.push({ key: 'oz', label: 'oz', grams: GRAMS_PER_OZ, factor: GRAMS_PER_OZ / 100 });
  } else if (food.basis === '100ml') {
    if (food.servingMl) {
      units.push({ key: SERVING_KEY, label: servingLabel, grams: null, factor: food.servingMl / 100 });
    }
    units.push({ key: 'ml', label: 'ml', grams: null, factor: 1 / 100 });
    units.push({ key: 'floz', label: 'fl oz', grams: null, factor: ML_PER_FL_OZ / 100 });
  } else {
    units.push({ key: SERVING_KEY, label: servingLabel, grams: food.servingG, factor: 1 });
    if (food.servingG) {
      for (const p of food.portions) {
        units.push({ key: portionKey(p.label), label: p.label, grams: p.grams, factor: p.grams / food.servingG });
      }
      units.push({ key: 'g', label: 'g', grams: 1, factor: 1 / food.servingG });
      units.push({ key: 'oz', label: 'oz', grams: GRAMS_PER_OZ, factor: GRAMS_PER_OZ / food.servingG });
    }
  }
  return units;
}

/** The unit a food opens with: its first portion or serving, else grams. */
export function defaultUnit(food: Food): FoodUnit {
  return unitsFor(food)[0];
}

export interface Measured {
  amount: number;
  unit: FoodUnit;
  /** Grams eaten, when the unit has a weight. */
  grams: number | null;
  /** The nutrients in what was eaten. */
  nutrients: Nutrients;
}

/** Largest amount accepted in one entry, matching the database's limit. */
export const MAX_AMOUNT = 100_000;

/** What `amount` of `unitKey` is worth, or null for a unit the food doesn't offer. */
export function measure(food: Food, amount: number, unitKey: string): Measured | null {
  if (!(amount > 0) || amount > MAX_AMOUNT) return null;
  const unit = unitsFor(food).find((u) => u.key === unitKey);
  if (!unit) return null;
  const grams = unit.grams == null ? null : Math.round(amount * unit.grams * 100) / 100;
  return { amount, unit, grams, nutrients: scaleNutrients(food.nutrients, amount * unit.factor) };
}

const PLAIN_UNITS = new Set(['g', 'oz', 'ml', 'fl oz']);

/** "150 g", "1 medium", "2 × 1 cup, sliced". */
export function formatAmount(amount: number, unitLabel: string): string {
  const n = Math.round(amount * 100) / 100;
  if (PLAIN_UNITS.has(unitLabel)) return `${n} ${unitLabel}`;
  return n === 1 ? unitLabel : `${n} × ${unitLabel}`;
}
