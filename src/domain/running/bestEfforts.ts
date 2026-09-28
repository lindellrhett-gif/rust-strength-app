/**
 * Best efforts: the fastest mile, 5K, 10K, half and full marathon inside any
 * run, not just runs of exactly that distance. A 7-mile run can hold your best
 * 10K. Pure, no I/O.
 *
 * For every point, the window that ends there and covers exactly the target
 * distance is found with two pointers, with its start interpolated between
 * fixes. Times are moving time, like splits.
 */

import type { TrackPoint } from './types';

export const EFFORT_DISTANCES = {
  mile: 1609.344,
  '5k': 5000,
  '10k': 10000,
  half: 21097.5,
  marathon: 42195,
} as const;

export type EffortKey = keyof typeof EFFORT_DISTANCES;
export const EFFORT_KEYS = Object.keys(EFFORT_DISTANCES) as EffortKey[];

export const EFFORT_LABEL: Record<EffortKey, string> = {
  mile: 'Mile',
  '5k': '5K',
  '10k': '10K',
  half: 'Half marathon',
  marathon: 'Marathon',
};

/** Fastest moving time, in whole seconds, for a single distance. Null if the run is too short. */
export function bestEffort(track: readonly TrackPoint[], metres: number): number | null {
  const n = track.length;
  if (n < 2 || track[n - 1].d < metres) return null;

  let best = Infinity;
  let i = 0;
  for (let j = 1; j < n; j += 1) {
    const end = track[j];
    if (end.d < metres) continue;
    const startD = end.d - metres;
    while (i + 1 < j && track[i + 1].d <= startD) i += 1;
    const a = track[i];
    const b = track[i + 1];
    const span = b.d - a.d;
    const f = span > 0 ? Math.min(1, Math.max(0, (startD - a.d) / span)) : 0;
    const startMt = a.mt + (b.mt - a.mt) * f;
    const seconds = end.mt - startMt;
    if (seconds > 0 && seconds < best) best = seconds;
  }
  return Number.isFinite(best) ? Math.round(best) : null;
}

export type BestEfforts = Partial<Record<EffortKey, number>>;

export function bestEfforts(track: readonly TrackPoint[]): BestEfforts {
  const out: BestEfforts = {};
  for (const key of EFFORT_KEYS) {
    const s = bestEffort(track, EFFORT_DISTANCES[key]);
    if (s != null) out[key] = s;
  }
  return out;
}

/** Personal records from many runs' best efforts: the fastest time per distance. */
export function personalRecords<T extends { efforts: BestEfforts }>(
  runs: readonly T[],
): Partial<Record<EffortKey, { seconds: number; run: T }>> {
  const out: Partial<Record<EffortKey, { seconds: number; run: T }>> = {};
  for (const run of runs) {
    for (const key of EFFORT_KEYS) {
      const s = run.efforts[key];
      if (s == null) continue;
      const current = out[key];
      if (!current || s < current.seconds) out[key] = { seconds: s, run };
    }
  }
  return out;
}
