/**
 * Recent and frequent foods, worked out from the diary itself. Pure, no I/O.
 *
 * Nothing extra is stored: the diary's own entries say what you eat and how
 * much, so "log it again" brings back the amount you had last time. Working
 * it out on the phone also means it works offline, from the cached diary.
 */

import type { DiaryEntry } from './entries';

/**
 * What makes two entries the same food: its id when it has one, else its
 * barcode, else its name and brand. Quick adds have none.
 */
export function foodKey(e: Pick<DiaryEntry, 'source' | 'foodId' | 'barcode' | 'name' | 'brand'>): string | null {
  if (e.source === 'quick') return null;
  if (e.foodId) return `id:${e.foodId}`;
  if (e.barcode) return `barcode:${e.barcode}`;
  return `name:${e.name.trim().toLowerCase()}|${(e.brand ?? '').trim().toLowerCase()}`;
}

const newestFirst = (a: DiaryEntry, b: DiaryEntry) => b.loggedAt.localeCompare(a.loggedAt);

/** The latest entry for each food, newest first. */
export function recentFoods(entries: readonly DiaryEntry[], limit = 30): DiaryEntry[] {
  const seen = new Set<string>();
  const out: DiaryEntry[] = [];
  for (const e of [...entries].sort(newestFirst)) {
    const key = foodKey(e);
    if (key == null || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

export interface FrequentFood {
  /** The latest entry for it, to log again as it was. */
  entry: DiaryEntry;
  /** Days on or after `since` it was logged. */
  days: number;
}

/**
 * Foods by how many days they were eaten since `since` (a local date), most
 * first; a tie goes to the one eaten more recently. Counting days, not
 * entries, keeps a food logged three times at one meal from crowding out a
 * daily habit.
 */
export function frequentFoods(entries: readonly DiaryEntry[], since: string, limit = 30): FrequentFood[] {
  const byKey = new Map<string, { entry: DiaryEntry; days: Set<string> }>();
  for (const e of [...entries].sort(newestFirst)) {
    if (e.day < since) continue;
    const key = foodKey(e);
    if (key == null) continue;
    const hit = byKey.get(key);
    if (hit) hit.days.add(e.day);
    else byKey.set(key, { entry: e, days: new Set([e.day]) });
  }
  return [...byKey.values()]
    .map(({ entry, days }) => ({ entry, days: days.size }))
    .sort((a, b) => b.days - a.days || newestFirst(a.entry, b.entry))
    .slice(0, limit);
}
