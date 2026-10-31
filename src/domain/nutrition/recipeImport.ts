/**
 * Importing a recipe from a web page. Pure, no I/O: the phone fetches the
 * page itself (src/lib/recipeImport.ts), so the link never reaches our server.
 *
 * Recipe sites publish their recipes as schema.org Recipe data, in a
 * <script type="application/ld+json"> block, for search engines; that is
 * what this reads. Each ingredient line is split into amount, unit and food
 * by parse-ingredient (MIT), then matched to a food and measured in one of
 * its units where possible. Anything uncertain is left for the person to pick.
 */

import { parseIngredient } from 'parse-ingredient';

import type { Food } from './foods';
import { unitsFor } from './foods';

export interface ImportedRecipe {
  name: string;
  /** How many servings the page says it makes, when it says. */
  servings: number | null;
  /** Ingredient lines as the page lists them. */
  lines: string[];
}

const ENTITIES: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', ndash: '–', mdash: '—',
};

/** Text with HTML tags and entities resolved, and whitespace tidied. */
function plain(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function isRecipe(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
}

/** Every object in a JSON-LD value: itself, its @graph, array members. */
function* nodes(value: unknown, depth = 0): Generator<Record<string, unknown>> {
  if (depth > 6 || value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const v of value) yield* nodes(v, depth + 1);
    return;
  }
  const obj = value as Record<string, unknown>;
  yield obj;
  if (obj['@graph']) yield* nodes(obj['@graph'], depth + 1);
}

/** "4", "4 servings", "Makes 12 cookies", ["6", "6 servings"] → the first whole number. */
export function servingsFrom(yieldValue: unknown): number | null {
  const values = Array.isArray(yieldValue) ? yieldValue : [yieldValue];
  for (const v of values) {
    const n = typeof v === 'number' ? v : Number(/(\d+(?:\.\d+)?)/.exec(plain(String(v ?? '')))?.[1]);
    if (Number.isFinite(n) && n > 0 && n <= 1000) return n;
  }
  return null;
}

/** The recipe on a page, or null when the page doesn't publish one. */
export function recipeFromHtml(html: string): ImportedRecipe | null {
  const blocks = html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of blocks) {
    let json: unknown;
    try {
      json = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    for (const node of nodes(json)) {
      if (!isRecipe(node)) continue;
      const raw = node.recipeIngredient ?? node.ingredients;
      const lines = (Array.isArray(raw) ? raw : [])
        .map((l) => plain(l))
        .filter((l) => l.length > 0)
        .slice(0, 200);
      if (lines.length === 0) continue;
      const name = plain(node.name).slice(0, 200) || 'Imported recipe';
      return { name, servings: servingsFrom(node.recipeYield), lines };
    }
  }
  return null;
}

export interface IngredientLine {
  text: string;
  quantity: number | null;
  /** parse-ingredient's unit id: "cup", "gram", "large", "can"; null for a plain count. */
  unit: string | null;
  /** The food, as typed: "all-purpose flour, sifted". */
  description: string;
  /** "For the sauce:" and the like: a heading, not an ingredient. */
  isHeading: boolean;
}

/** One line as amount, unit and food. A range ("3-4 cloves") counts as its middle. */
export function parseLine(text: string): IngredientLine {
  const parsed = parseIngredient(text)[0];
  if (!parsed) return { text, quantity: null, unit: null, description: text, isHeading: false };
  const q =
    parsed.quantity != null && parsed.quantity2 != null
      ? (parsed.quantity + parsed.quantity2) / 2
      : parsed.quantity;
  return {
    text,
    quantity: q != null && Number.isFinite(q) && q > 0 ? q : null,
    unit: parsed.unitOfMeasureID ?? null,
    description: parsed.description.trim(),
    isHeading: parsed.isGroupHeader,
  };
}

/** What to search the food catalog for: the food without its preparation notes. */
export function searchTermFor(line: IngredientLine): string {
  return line.description
    .replace(/\([^)]*\)/g, ' ')
    .split(/,| - | or /)[0]
    .replace(/\b(chopped|diced|minced|sliced|fresh|large|medium|small|to taste|optional)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

const GRAMS: Record<string, number> = { gram: 1, kilogram: 1000, milligram: 0.001, ounce: 28.349523125, pound: 453.59237 };
const MILLILITRES: Record<string, number> = {
  milliliter: 1, liter: 1000, deciliter: 100, 'fluid ounce': 29.5735295625, cup: 236.5882365,
  tablespoon: 14.78676478125, teaspoon: 4.92892159375, pint: 473.176473, quart: 946.352946, gallon: 3785.411784,
};
/** How USDA writes a household measure at the start of a portion: "1 cup, chopped", "1 tbsp". */
const PORTION_WORDS: Record<string, RegExp> = {
  cup: /^1 cups?\b/i,
  tablespoon: /^1 (tbsp|tablespoons?)\b/i,
  teaspoon: /^1 (tsp|teaspoons?)\b/i,
  large: /\blarge\b/i,
  medium: /\bmedium\b/i,
  small: /\bsmall\b/i,
  clove: /\bcloves?\b/i,
  slice: /\bslices?\b/i,
  stick: /\bsticks?\b/i,
};
const VOLUME_START = /^1 (cups?|tbsp|tablespoons?|tsp|teaspoons?|fl oz|ml)\b/i;

export interface Measure {
  amount: number;
  unitKey: string;
}

/**
 * The line's amount in one of the food's units, or null when it can't be
 * worked out and the person should choose.
 */
export function measureLine(food: Food, line: IngredientLine): Measure | null {
  const q = line.quantity;
  if (q == null) return null;
  const units = unitsFor(food);
  const has = (key: string) => units.some((u) => u.key === key);
  const round = (n: number) => Math.round(n * 100) / 100;

  // "1 (14 oz) can black beans": the can's stated weight.
  const stated = /^\((\d+(?:\.\d+)?)\s*(oz|ounces?|g|grams?)\)/i.exec(line.description);
  if (stated && has('g')) {
    const grams = Number(stated[1]) * (/^o/i.test(stated[2]) ? GRAMS.ounce : 1);
    return { amount: round(q * grams), unitKey: 'g' };
  }

  const unit = line.unit;
  if (unit && GRAMS[unit] != null && has('g')) {
    return unit === 'ounce' && has('oz') ? { amount: round(q), unitKey: 'oz' } : { amount: round(q * GRAMS[unit]), unitKey: 'g' };
  }
  if (unit && PORTION_WORDS[unit]) {
    const portion = food.portions.find((p) => PORTION_WORDS[unit].test(p.label));
    if (portion) return { amount: round(q), unitKey: `portion:${portion.label}` };
  }
  if (unit && MILLILITRES[unit] != null && has('ml')) {
    return { amount: round(q * MILLILITRES[unit]), unitKey: 'ml' };
  }
  if (!unit) {
    // A count: "2 eggs", "1 banana". The food's first portion that isn't a
    // cup or spoon is the natural one; else its serving.
    const each = food.portions.find((p) => !VOLUME_START.test(p.label));
    if (each) return { amount: round(q), unitKey: `portion:${each.label}` };
    if (has('serving')) return { amount: round(q), unitKey: 'serving' };
  }
  return null;
}
