/**
 * Looking a barcode up on Open Food Facts, from the phone.
 *
 * Each phone asks for itself, so the API's limit (15 product reads a minute
 * per IP address) applies to one person scanning, never to everyone at once.
 * Nothing is sent but the barcode and the app's name.
 */

import type { Food } from '@/domain/nutrition/foods';
import {
  barcodeCandidates,
  foodFromOpenFoodFacts,
  foodsFromSearch,
  offProductUrl,
  offSearchUrl,
  OFF_USER_AGENT,
  type OffResult,
} from '@/domain/nutrition/openFoodFacts';

export type LookupResult = OffResult | { problem: 'offline' | 'unavailable' };

const TIMEOUT_MS = 10_000;

async function fetchProduct(code: string): Promise<unknown | 'missing'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(offProductUrl(code), {
      headers: { 'User-Agent': OFF_USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) return 'missing';
    if (!res.ok) throw new Error(`Open Food Facts answered ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The product for a scanned code, trying each form of it (a UPC-A is listed
 * with or without its leading zero). `offline` when there's no connection,
 * `unavailable` when Open Food Facts didn't answer properly.
 */
export async function lookupBarcode(scanned: string): Promise<LookupResult> {
  const codes = barcodeCandidates(scanned);
  if (codes.length === 0) return { problem: 'not_found' };
  let sawNoNutrition = false;
  for (const code of codes) {
    let body: unknown;
    try {
      body = await fetchProduct(code);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      return { problem: /network|abort|failed to fetch/i.test(message) ? 'offline' : 'unavailable' };
    }
    if (body === 'missing') continue;
    const result = foodFromOpenFoodFacts(body, code);
    if ('food' in result) return result;
    if (result.problem === 'no_nutrition') sawNoNutrition = true;
  }
  return { problem: sawNoNutrition ? 'no_nutrition' : 'not_found' };
}

/**
 * Products matching a text search, or a problem. One request per tap of
 * "Search Open Food Facts", never per keystroke.
 */
export async function searchOpenFoodFacts(
  query: string,
): Promise<{ foods: Food[] } | { problem: 'offline' | 'unavailable' }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(offSearchUrl(query), {
      headers: { 'User-Agent': OFF_USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return { problem: 'unavailable' };
    return { foods: foodsFromSearch(await res.json()) };
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    return { problem: /network|abort|failed to fetch/i.test(message) ? 'offline' : 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
