/**
 * Searching a list by name, forgiving typos: "bech press" finds Bench Press,
 * "dumbell" finds Dumbbell Curl, "pullup" finds Pull-Up.
 *
 * Every word typed has to match a word of the name or its sublabel (the
 * muscle group, for exercises): exactly, as the start of a word still being
 * typed, or within a letter or two. How many letters may be off grows with
 * the word: none up to three letters, since short words are too often a
 * letter apart from each other ("row" and "raw"), one up to six, two after
 * that. Swapping two neighbouring letters counts as one.
 *
 * Results that contain what was typed come first, then the near misses, each
 * group in the list's own order.
 */

export interface Searchable {
  label: string;
  sublabel?: string;
}

/** Lower case, accents dropped, and anything but letters and digits as a single space. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** How many letters a typed word may be off by. */
export function typoAllowance(length: number): number {
  return length <= 3 ? 0 : length <= 6 ? 1 : 2;
}

/**
 * Letters to add, remove, change or swap with a neighbour to turn `a` into
 * `b` (the optimal string alignment distance). Anything over `max` comes back
 * as `max + 1`, so long words that are nothing alike stop early.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prevPrev[j - 2] + 1);
      }
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    prevPrev = prev;
    prev = row;
  }
  return Math.min(prev[b.length], max + 1);
}

/** How well one typed word matches the best of `words`: 0 is exact, null is no match. */
function wordScore(typed: string, words: readonly string[]): number | null {
  const allow = typoAllowance(typed.length);
  let best: number | null = null;
  const consider = (score: number) => {
    if (best == null || score < best) best = score;
  };
  for (const w of words) {
    if (w === typed) return 0;
    if (w.startsWith(typed)) consider(0.1);
    if (allow === 0) continue;
    const d = editDistance(typed, w, allow);
    if (d <= allow) consider(d);
    // A typo in a word still being typed: "dumbe" for "dumbbell".
    for (const len of [typed.length, typed.length + 1]) {
      if (w.length <= len) continue;
      const p = editDistance(typed, w.slice(0, len), allow);
      if (p <= allow) consider(p + 0.5);
    }
  }
  return best;
}

/** Lower is a better match; null means it doesn't match at all. */
export function searchScore(item: Searchable, query: string): number | null {
  const q = normalize(query);
  if (!q) return 0;
  const label = normalize(item.label);
  const sub = normalize(item.sublabel ?? '');

  if (label.startsWith(q)) return 0;
  if (label.includes(q)) return 1;
  // Spaces and punctuation typed differently: "pullup", "lat pull down".
  if (label.replace(/ /g, '').includes(q.replace(/ /g, ''))) return 2;
  if (sub.includes(q)) return 3;

  const words = [...label.split(' '), ...sub.split(' ')].filter(Boolean);
  let total = 0;
  for (const typed of q.split(' ')) {
    const s = wordScore(typed, words);
    if (s == null) return null;
    total += s;
  }
  return 4 + total;
}

/** The items matching `query`, best first. A blank query returns them all, as they were. */
export function search<T extends Searchable>(items: readonly T[], query: string): T[] {
  if (!normalize(query)) return [...items];
  return items
    .map((item, index) => ({ item, index, score: searchScore(item, query) }))
    .filter((r): r is { item: T; index: number; score: number } => r.score != null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((r) => r.item);
}
