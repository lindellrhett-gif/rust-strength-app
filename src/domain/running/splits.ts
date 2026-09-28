/**
 * Per-mile or per-kilometre splits. Pure, no I/O.
 *
 * Each boundary is placed where the runner actually crossed it, interpolated
 * between the fixes either side, so a split is not a few metres long or short
 * depending on where the phone happened to take a fix. Split times are moving
 * time, so a stop at a light does not make that mile look slow.
 */

import { atDistance } from './track';
import type { TrackPoint } from './types';

export interface Split {
  /** 1 for the first mile or kilometre. */
  index: number;
  /** Length of the split in metres: the full unit, or less for the last one. */
  distanceM: number;
  /** Moving seconds taken to cover it. */
  seconds: number;
  /** Net climb (positive) or drop (negative) in metres, when altitude is known. */
  elevationChangeM: number | null;
  /** True for the leftover distance after the last full split. */
  partial: boolean;
}

/** A leftover shorter than this is not worth its own row. */
export const MIN_PARTIAL_SPLIT_M = 10;

export function computeSplits(track: readonly TrackPoint[], unitMeters: number): Split[] {
  if (track.length < 2 || !(unitMeters > 0)) return [];
  const total = track[track.length - 1].d;
  const splits: Split[] = [];

  let start = atDistance(track, 0);
  let startD = 0;
  for (let k = 1; start; k += 1) {
    const endD = Math.min(k * unitMeters, total);
    const partial = endD < k * unitMeters;
    if (partial && endD - startD < MIN_PARTIAL_SPLIT_M) break;
    const end = atDistance(track, endD);
    if (!end) break;
    splits.push({
      index: k,
      distanceM: endD - startD,
      seconds: end.mt - start.mt,
      elevationChangeM: start.alt != null && end.alt != null ? end.alt - start.alt : null,
      partial,
    });
    if (partial || endD >= total) break;
    start = end;
    startD = endD;
  }
  return splits;
}
