/**
 * The "create a food" form: what someone types from a label, checked, and
 * turned into a Food (and back, to edit one). Pure, no I/O.
 *
 * Labels give numbers per serving, so that is the default. A food can also be
 * entered per 100 g or per 100 ml, as European labels and USDA print them.
 */

import type { Food, FoodBasis } from './foods';
import { NUTRIENT_KEYS, NUTRIENT_LABELS, emptyNutrients, type NutrientKey, type Nutrients } from './nutrients';
import { canonicalBarcode } from './openFoodFacts';

/** Everything as typed. Nutrient fields hold text so a half-typed "1." is allowed. */
export interface FoodDraft {
  name: string;
  brand: string;
  barcode: string;
  basis: FoodBasis;
  /** "1 bar", "2 cookies (30 g)". */
  servingLabel: string;
  /** Grams in a serving for a solid, millilitres for a drink; optional. */
  servingSize: string;
  nutrients: Record<NutrientKey, string>;
}

export function emptyDraft(barcode = ''): FoodDraft {
  const nutrients = {} as Record<NutrientKey, string>;
  for (const key of NUTRIENT_KEYS) nutrients[key] = '';
  return { name: '', brand: '', barcode, basis: 'serving', servingLabel: '1 serving', servingSize: '', nutrients };
}

function numberText(n: number | null): string {
  return n == null ? '' : String(Math.round(n * 1000) / 1000);
}

/** A food as the form shows it, to edit it or to start from an Open Food Facts product. */
export function draftFromFood(food: Food): FoodDraft {
  const nutrients = {} as Record<NutrientKey, string>;
  for (const key of NUTRIENT_KEYS) nutrients[key] = numberText(food.nutrients[key]);
  const size = food.basis === '100ml' ? food.servingMl : food.servingG;
  return {
    name: food.name,
    brand: food.brand ?? '',
    barcode: food.barcode ?? '',
    basis: food.basis,
    servingLabel: food.servingLabel ?? (food.basis === 'serving' ? '1 serving' : ''),
    servingSize: numberText(size),
    nutrients,
  };
}

export interface DraftProblem {
  field: 'name' | 'brand' | 'barcode' | 'servingLabel' | 'servingSize' | NutrientKey;
  message: string;
}

/** Per 100 g a food can't pass about 900 kcal; per serving, a whole meal can be large. */
const MAX_KCAL: Record<FoodBasis, number> = { '100g': 1000, '100ml': 1000, serving: 20_000 };

function readNumber(typed: string): number | null | 'bad' {
  const t = typed.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? n : 'bad';
}

export type DraftResult = { food: Omit<Food, 'id' | 'source' | 'portions'> } | { problems: DraftProblem[] };

/** The draft as a food, or what to fix. Calories are the only number required. */
export function foodFromDraft(draft: FoodDraft): DraftResult {
  const problems: DraftProblem[] = [];
  const name = draft.name.replace(/\s+/g, ' ').trim();
  const brand = draft.brand.replace(/\s+/g, ' ').trim();
  if (!name) problems.push({ field: 'name', message: 'Give the food a name.' });
  else if (name.length > 200) problems.push({ field: 'name', message: 'Keep the name under 200 characters.' });
  if (brand.length > 120) problems.push({ field: 'brand', message: 'Keep the brand under 120 characters.' });

  const barcodeTyped = draft.barcode.trim();
  const barcode = barcodeTyped ? canonicalBarcode(barcodeTyped) : null;
  if (barcodeTyped && !barcode) problems.push({ field: 'barcode', message: 'A barcode is 8 to 14 digits.' });

  const servingLabel = draft.servingLabel.replace(/\s+/g, ' ').trim();
  if (draft.basis === 'serving' && !servingLabel) {
    problems.push({ field: 'servingLabel', message: 'Say what one serving is, like "1 bar".' });
  }
  if (servingLabel.length > 60) problems.push({ field: 'servingLabel', message: 'Keep the serving under 60 characters.' });

  const size = readNumber(draft.servingSize);
  if (size === 'bad' || size === 0 || (typeof size === 'number' && size > 10_000)) {
    problems.push({ field: 'servingSize', message: 'The serving size is a number of grams (or ml) above zero.' });
  }

  const nutrients = emptyNutrients() as Nutrients;
  for (const key of NUTRIENT_KEYS) {
    const v = readNumber(draft.nutrients[key]);
    if (v === 'bad') {
      problems.push({ field: key, message: `${NUTRIENT_LABELS[key].label} is a number, zero or more.` });
    } else if (key === 'kcal') {
      if (v == null) problems.push({ field: 'kcal', message: 'Calories are needed; the rest can be left blank.' });
      else if (v > MAX_KCAL[draft.basis]) {
        problems.push({ field: 'kcal', message: `That's more calories than ${draft.basis === 'serving' ? 'a serving' : '100 g'} can hold.` });
      } else nutrients.kcal = v;
    } else {
      nutrients[key] = v;
    }
  }
  const per100 = draft.basis !== 'serving';
  for (const key of ['fatG', 'carbsG', 'proteinG'] as const) {
    if (per100 && (nutrients[key] ?? 0) > 100) {
      problems.push({ field: key, message: `100 g can't hold more than 100 g of ${NUTRIENT_LABELS[key].label.toLowerCase()}.` });
    }
  }

  if (problems.length > 0) return { problems };
  const sizeValue = typeof size === 'number' ? size : null;
  return {
    food: {
      barcode,
      name,
      brand: brand || null,
      basis: draft.basis,
      servingLabel: servingLabel || null,
      servingG: draft.basis === '100ml' ? null : sizeValue,
      servingMl: draft.basis === '100ml' ? sizeValue : null,
      nutrients,
    },
  };
}
