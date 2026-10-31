/**
 * Fetching a recipe page, from the phone. The link goes straight from the
 * phone to the recipe site; Rust Strength's server never sees it.
 */

import { recipeFromHtml, type ImportedRecipe } from '@/domain/nutrition/recipeImport';

const TIMEOUT_MS = 15_000;
/** Recipe pages run to a few hundred kilobytes; past this something is wrong. */
const MAX_CHARS = 5_000_000;

export type RecipeFetch = { recipe: ImportedRecipe } | { problem: 'bad_link' | 'offline' | 'unavailable' | 'no_recipe' };

/** A link as typed, made into an https or http URL, or null. */
export function recipeUrl(typed: string): string | null {
  const t = typed.trim();
  if (!t) return null;
  const withScheme = /^[a-z]+:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function fetchRecipe(typed: string): Promise<RecipeFetch> {
  const url = recipeUrl(typed);
  if (!url) return { problem: 'bad_link' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: 'text/html' }, signal: controller.signal });
    if (!res.ok) return { problem: 'unavailable' };
    const html = (await res.text()).slice(0, MAX_CHARS);
    const recipe = recipeFromHtml(html);
    return recipe ? { recipe } : { problem: 'no_recipe' };
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    return { problem: /network|abort|failed to fetch/i.test(message) ? 'offline' : 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
