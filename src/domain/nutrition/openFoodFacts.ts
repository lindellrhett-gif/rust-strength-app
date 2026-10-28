/**
 * Reading an Open Food Facts product as a Food. Pure, no I/O; the lookup
 * itself happens on the phone (src/data), so the API's limits (15 product
 * reads a minute per IP) apply to each person, not to the app as a whole.
 *
 * Open Food Facts data is under the Open Database License and comes with
 * "no assurances that the data is accurate", so the app shows where a food
 * came from and lets people copy it into My Foods to correct it.
 *
 * Two things to know about the API's numbers:
 *  - every `_100g` mass is in grams, whatever unit the label used, so sodium
 *    0.288 is 288 mg;
 *  - `_100g` means per 100 ml for a drink, though the key still says 100g.
 */

import type { Food, FoodBasis } from './foods';
import { emptyNutrients, KJ_PER_KCAL, type Nutrients } from './nutrients';

/** Identifies the app to Open Food Facts, as its API asks. */
export const OFF_USER_AGENT = 'RustStrength/1.2 (ruststrengthsupport@gmail.com)';

/** Only what the diary uses, to keep each response small. */
export const OFF_FIELDS = [
  'code',
  'product_name',
  'generic_name',
  'brands',
  'quantity',
  'product_quantity_unit',
  'serving_size',
  'serving_quantity',
  'nutriments',
].join(',');

export function offProductUrl(barcode: string): string {
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
}

/**
 * One form for a barcode, so the same product always matches itself: a
 * 12-digit UPC-A becomes the 13-digit EAN with a leading zero, which is how
 * Open Food Facts lists it (737628064502 comes back as 0737628064502).
 * Null for anything that isn't a barcode.
 */
export function canonicalBarcode(code: string): string | null {
  const digits = code.replace(/\D/g, '');
  if (!/^\d{8,14}$/.test(digits)) return null;
  return digits.length === 12 ? `0${digits}` : digits;
}

/**
 * The codes worth looking up for a scan. iOS reports a 12-digit UPC-A as a
 * 13-digit EAN with a leading zero; products are listed under either.
 */
export function barcodeCandidates(scanned: string): string[] {
  const code = scanned.replace(/\D/g, '');
  if (!/^\d{8,14}$/.test(code)) return [];
  if (code.length === 13 && code.startsWith('0')) return [code, code.slice(1)];
  if (code.length === 12) return [code, `0${code}`];
  return [code];
}

type Nutriments = Record<string, unknown>;

function num(n: Nutriments, key: string): number | null {
  const v = n[key];
  const x = typeof v === 'string' ? Number(v) : v;
  return typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null;
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** grams → mg or µg, keeping unknown as unknown. */
function scaled(v: number | null, by: number): number | null {
  return v == null ? null : round(v * by);
}

function nutrientsFrom(n: Nutriments, suffix: '_100g' | '_serving'): Nutrients | null {
  const kj = num(n, `energy-kj${suffix}`) ?? num(n, `energy${suffix}`);
  const kcal = num(n, `energy-kcal${suffix}`) ?? (kj == null ? null : kj / KJ_PER_KCAL);
  if (kcal == null) return null;
  const sodium = num(n, `sodium${suffix}`) ?? (num(n, `salt${suffix}`) == null ? null : (num(n, `salt${suffix}`) as number) / 2.5);
  return {
    ...emptyNutrients(),
    kcal: round(kcal),
    fatG: num(n, `fat${suffix}`),
    satFatG: num(n, `saturated-fat${suffix}`),
    transFatG: num(n, `trans-fat${suffix}`),
    cholesterolMg: scaled(num(n, `cholesterol${suffix}`), 1000),
    sodiumMg: scaled(sodium, 1000),
    carbsG: num(n, `carbohydrates${suffix}`),
    fiberG: num(n, `fiber${suffix}`),
    sugarsG: num(n, `sugars${suffix}`),
    addedSugarsG: num(n, `added-sugars${suffix}`),
    proteinG: num(n, `proteins${suffix}`),
    vitaminDMcg: scaled(num(n, `vitamin-d${suffix}`), 1_000_000),
    calciumMg: scaled(num(n, `calcium${suffix}`), 1000),
    ironMg: scaled(num(n, `iron${suffix}`), 1000),
    potassiumMg: scaled(num(n, `potassium${suffix}`), 1000),
  };
}

function isDrink(p: Record<string, unknown>): boolean {
  const unit = typeof p.product_quantity_unit === 'string' ? p.product_quantity_unit.toLowerCase() : '';
  if (unit === 'ml' || unit === 'l' || unit === 'cl') return true;
  if (unit === 'g' || unit === 'kg') return false;
  return typeof p.quantity === 'string' && /\d\s*(ml|cl|l|fl\.?\s*oz)\b/i.test(p.quantity);
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Pure fat is about 900 kcal per 100 g; past this the listing is wrong. */
const MAX_KCAL_PER_100 = 1000;

export type OffResult =
  | { food: Food }
  | { problem: 'not_found' | 'no_nutrition' };

/** An API response (`/api/v2/product/<code>.json`) as a Food, not yet saved. */
export function foodFromOpenFoodFacts(response: unknown, barcode: string): OffResult {
  const r = response as { status?: unknown; product?: Record<string, unknown> } | null;
  if (!r || r.status !== 1 || !r.product || typeof r.product !== 'object') return { problem: 'not_found' };
  const p = r.product;
  const n = (p.nutriments && typeof p.nutriments === 'object' ? p.nutriments : {}) as Nutriments;

  const servingQty = num(p as Nutriments, 'serving_quantity');
  const servingLabel = text(p.serving_size, 60);
  const drink = isDrink(p);

  let basis: FoodBasis = drink ? '100ml' : '100g';
  let nutrients = nutrientsFrom(n, '_100g');
  if (nutrients && nutrients.kcal > MAX_KCAL_PER_100) nutrients = null;
  if (!nutrients) {
    // Some products are only listed per serving.
    nutrients = servingLabel ? nutrientsFrom(n, '_serving') : null;
    basis = 'serving';
  }
  if (!nutrients) return { problem: 'no_nutrition' };

  const code = (typeof p.code === 'string' ? canonicalBarcode(p.code) : null) ?? canonicalBarcode(barcode);
  const brand = text(typeof p.brands === 'string' ? p.brands.split(',')[0] : null, 120);
  return {
    food: {
      id: null,
      source: 'off',
      barcode: code,
      name: text(p.product_name, 200) ?? text(p.generic_name, 200) ?? 'Unnamed product',
      brand,
      basis,
      servingLabel: servingLabel ?? (basis === 'serving' ? '1 serving' : null),
      servingG: !drink && servingQty ? servingQty : null,
      servingMl: drink && servingQty ? servingQty : null,
      nutrients,
      portions: [],
    },
  };
}
