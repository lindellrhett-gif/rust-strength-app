/**
 * The label nutrients the diary keeps, and arithmetic on them. Pure, no I/O.
 *
 * The set is the US Nutrition Facts label, so a food typed in from a package
 * has a place for every line on it. Every amount but energy can be unknown
 * (null), which is not the same as zero: Open Food Facts products often list
 * only some lines, and adding an unknown as zero would understate the day.
 */

export const NUTRIENT_KEYS = [
  'kcal',
  'fatG',
  'satFatG',
  'transFatG',
  'cholesterolMg',
  'sodiumMg',
  'carbsG',
  'fiberG',
  'sugarsG',
  'addedSugarsG',
  'proteinG',
  'vitaminDMcg',
  'calciumMg',
  'ironMg',
  'potassiumMg',
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** Energy is always known; the rest may not be. */
export type Nutrients = { kcal: number } & { [K in Exclude<NutrientKey, 'kcal'>]: number | null };

/** The database column for each nutrient (migration 0027). */
export const NUTRIENT_COLUMNS: Record<NutrientKey, string> = {
  kcal: 'kcal',
  fatG: 'fat_g',
  satFatG: 'sat_fat_g',
  transFatG: 'trans_fat_g',
  cholesterolMg: 'cholesterol_mg',
  sodiumMg: 'sodium_mg',
  carbsG: 'carbs_g',
  fiberG: 'fiber_g',
  sugarsG: 'sugars_g',
  addedSugarsG: 'added_sugars_g',
  proteinG: 'protein_g',
  vitaminDMcg: 'vitamin_d_mcg',
  calciumMg: 'calcium_mg',
  ironMg: 'iron_mg',
  potassiumMg: 'potassium_mg',
};

/** How each nutrient reads on screen, in label order. */
export const NUTRIENT_LABELS: Record<NutrientKey, { label: string; unit: string }> = {
  kcal: { label: 'Calories', unit: 'kcal' },
  fatG: { label: 'Fat', unit: 'g' },
  satFatG: { label: 'Saturated fat', unit: 'g' },
  transFatG: { label: 'Trans fat', unit: 'g' },
  cholesterolMg: { label: 'Cholesterol', unit: 'mg' },
  sodiumMg: { label: 'Sodium', unit: 'mg' },
  carbsG: { label: 'Carbohydrate', unit: 'g' },
  fiberG: { label: 'Fiber', unit: 'g' },
  sugarsG: { label: 'Sugars', unit: 'g' },
  addedSugarsG: { label: 'Added sugars', unit: 'g' },
  proteinG: { label: 'Protein', unit: 'g' },
  vitaminDMcg: { label: 'Vitamin D', unit: 'mcg' },
  calciumMg: { label: 'Calcium', unit: 'mg' },
  ironMg: { label: 'Iron', unit: 'mg' },
  potassiumMg: { label: 'Potassium', unit: 'mg' },
};

export const KJ_PER_KCAL = 4.184;

/** Energy from each gram of a macronutrient (the general Atwater factors). */
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Nothing eaten: energy zero, everything else unknown. */
export function emptyNutrients(): Nutrients {
  const out = { kcal: 0 } as Nutrients;
  for (const key of NUTRIENT_KEYS) if (key !== 'kcal') out[key] = null;
  return out;
}

/** Three decimals is past anything a label or USDA reports. */
function tidy(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Every amount multiplied by `factor` (an amount eaten over the food's basis). */
export function scaleNutrients(per: Nutrients, factor: number): Nutrients {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 0;
  const out = { kcal: tidy(per.kcal * f) } as Nutrients;
  for (const key of NUTRIENT_KEYS) {
    if (key === 'kcal') continue;
    const v = per[key];
    out[key] = v == null ? null : tidy(v * f);
  }
  return out;
}

/**
 * The sum of several. A nutrient stays unknown only if every part is unknown;
 * otherwise the known parts are added and the unknown ones count as nothing,
 * which is how a label total would read with a line missing.
 */
export function sumNutrients(parts: readonly Nutrients[]): Nutrients {
  const out = emptyNutrients();
  for (const part of parts) {
    out.kcal = tidy(out.kcal + part.kcal);
    for (const key of NUTRIENT_KEYS) {
      if (key === 'kcal') continue;
      const v = part[key];
      if (v != null) out[key] = tidy((out[key] ?? 0) + v);
    }
  }
  return out;
}

/** Carbohydrate minus fiber, never below zero; unknown without carbs. */
export function netCarbs(n: Pick<Nutrients, 'carbsG' | 'fiberG'>): number | null {
  if (n.carbsG == null) return null;
  return Math.max(0, tidy(n.carbsG - (n.fiberG ?? 0)));
}

/** Energy as the person reads it. */
export function energyIn(kcal: number, unit: 'kcal' | 'kj'): number {
  return Math.round(unit === 'kj' ? kcal * KJ_PER_KCAL : kcal);
}

/** A database row's nutrient columns, as Nutrients. */
export function nutrientsFromRow(row: Record<string, unknown>): Nutrients {
  const out = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    const v = row[NUTRIENT_COLUMNS[key]];
    const n = typeof v === 'number' && Number.isFinite(v) ? v : null;
    if (key === 'kcal') out.kcal = n ?? 0;
    else out[key] = n;
  }
  return out;
}

/** Nutrients as database columns, for an insert. */
export function nutrientsToRow(n: Nutrients): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const key of NUTRIENT_KEYS) out[NUTRIENT_COLUMNS[key]] = n[key];
  return out;
}
