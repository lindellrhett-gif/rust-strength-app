/**
 * Cleaning raw GPS fixes before any distance is counted. Pure, no I/O.
 *
 * Phones report plenty of fixes that should not become distance:
 *   - vague ones, with an accuracy radius wider than a street,
 *   - spikes, where one fix lands hundreds of metres off and snaps back,
 *   - jitter while standing still, which adds a few metres every second at a
 *     red light and quietly turns a 5K into a 5.3K.
 *
 * The rules, in order:
 *   1. Drop invalid coordinates, and anything vaguer than MAX_ACCURACY_M.
 *   2. Drop fixes that would mean running faster than MAX_SPEED_MPS from the
 *      last good fix. If several dropped fixes in a row agree with each other,
 *      the last good fix was the outlier, not them: the track re-anchors on
 *      them, and the jump itself counts as no distance.
 *   3. Drop fixes too close to the last good fix to be real movement: under
 *      MIN_MOVE_M, or inside most of the accuracy radius. That is the jitter.
 *      Time still passes, so a long stop shows up as a slow interval and
 *      auto-pause can take it out of moving time.
 *   4. Smooth what is left lightly, which takes the zig-zag out of a straight
 *      line without cutting corners.
 *
 * A signal gap, like a tunnel, needs no special case: the fix after it joins
 * the one before with a straight line if running that far in that time was
 * possible, and is treated as a spike otherwise.
 */

import { haversine, isValidCoord } from './geo';
import { AUTO_PAUSE_SPEED_MPS } from './track';
import type { CleanFix, GpsFix } from './types';

/** Fixes vaguer than this are ignored. */
export const MAX_ACCURACY_M = 25;
/** Faster than this between two fixes is a spike. About a 2:40 mile. */
export const MAX_SPEED_MPS = 10;
/** Movement smaller than this is always jitter, not running. */
export const MIN_MOVE_M = 3;
/**
 * A standing phone wanders inside its own accuracy radius, so movement smaller
 * than this share of the radius is jitter too, up to MAX_STILL_RADIUS_M.
 */
export const STILL_ACCURACY_FRACTION = 0.75;
export const MAX_STILL_RADIUS_M = 10;
/** This many agreeing fixes after a spike mean the track really moved. */
export const REANCHOR_FIXES = 3;
/** Altitudes vaguer than this are dropped; the position is still used. */
export const MAX_ALT_ACCURACY_M = 20;

export interface FilterReport {
  fixes: CleanFix[];
  rejected: {
    invalid: number;
    inaccurate: number;
    duplicate: number;
    spike: number;
    stationary: number;
  };
}

/** How far a fix must be from the last good one to count as movement. */
export function stillRadius(a: GpsFix, b: GpsFix): number {
  const accuracy = Math.max(a.accuracy ?? 0, b.accuracy ?? 0);
  return Math.max(MIN_MOVE_M, Math.min(MAX_STILL_RADIUS_M, accuracy * STILL_ACCURACY_FRACTION));
}

function speed(a: GpsFix, b: GpsFix): number {
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0) return Infinity;
  return haversine(a, b) / dt;
}

export function filterFixes(input: readonly GpsFix[]): FilterReport {
  const rejected = { invalid: 0, inaccurate: 0, duplicate: 0, spike: 0, stationary: 0 };

  const valid = input.filter((f) => {
    const ok = isValidCoord(f) && Number.isFinite(f.t) && Number.isInteger(f.seg) && f.seg >= 0;
    if (!ok) rejected.invalid += 1;
    return ok;
  });
  // Fixes can arrive out of order from a batched background delivery.
  valid.sort((a, b) => a.t - b.t);

  const kept: CleanFix[] = [];
  /** Consecutive spike-rejected fixes that agree with one another. */
  let pending: GpsFix[] = [];
  /** Index in `kept` where the current unbroken stretch began. */
  let stretchStart = 0;
  /** Time of the latest fix dropped as jitter since the last kept fix. */
  let lastStillT: number | null = null;

  for (const raw of valid) {
    if (raw.accuracy != null && raw.accuracy > MAX_ACCURACY_M) {
      rejected.inaccurate += 1;
      continue;
    }
    const fix: GpsFix =
      raw.alt != null && raw.altAccuracy != null && raw.altAccuracy > MAX_ALT_ACCURACY_M
        ? { ...raw, alt: null }
        : raw;

    const last = kept[kept.length - 1];
    if (!last) {
      kept.push({ ...fix, joined: false });
      stretchStart = 0;
      continue;
    }
    if (fix.t <= last.t) {
      rejected.duplicate += 1;
      continue;
    }
    // A new recording segment starts fresh: no line back across a pause.
    if (fix.seg !== last.seg) {
      pending = [];
      lastStillT = null;
      stretchStart = kept.length;
      kept.push({ ...fix, joined: false });
      continue;
    }

    if (speed(last, fix) > MAX_SPEED_MPS) {
      const prev = pending[pending.length - 1];
      pending = prev && speed(prev, fix) <= MAX_SPEED_MPS ? [...pending, fix] : [fix];
      rejected.spike += 1;

      if (pending.length >= REANCHOR_FIXES) {
        // The stretch we were following was the outlier. If it was only a
        // couple of fixes long, it was a spike of its own, so drop it.
        const stretchLength = kept.length - stretchStart;
        if (stretchLength < REANCHOR_FIXES) {
          rejected.spike += stretchLength;
          kept.length = stretchStart;
        }
        rejected.spike -= pending.length;
        const joinable = kept.length > 0 && kept[kept.length - 1].seg === pending[0].seg;
        stretchStart = kept.length;
        pending.forEach((p, i) =>
          kept.push({
            ...p,
            // After dropping a short outlier stretch, the new fixes may join
            // what came before it; after a genuine jump they may not.
            joined:
              i > 0 ||
              (joinable &&
                stretchLength < REANCHOR_FIXES &&
                speed(kept[kept.length - 1], p) <= MAX_SPEED_MPS),
          }),
        );
        pending = [];
        lastStillT = null;
      }
      continue;
    }
    pending = [];

    if (haversine(last, fix) < stillRadius(last, fix)) {
      rejected.stationary += 1;
      // Only evidence of standing still if there was no progress either: a
      // slow walk also drops a fix or two, but it keeps getting further away.
      if (speed(last, fix) < AUTO_PAUSE_SPEED_MPS) lastStillT = fix.t;
      continue;
    }
    kept.push({ ...fix, joined: true, stillMs: lastStillT != null ? lastStillT - last.t : 0 });
    lastStillT = null;
  }

  return { fixes: smooth(kept), rejected };
}

/**
 * A 1-2-1 moving average over each unbroken stretch. Ends of a stretch stay
 * put, so starts, finishes and pauses are exactly where they were recorded.
 */
export function smooth(fixes: readonly CleanFix[]): CleanFix[] {
  return fixes.map((f, i) => {
    const prev = fixes[i - 1];
    const next = fixes[i + 1];
    if (!prev || !next || !f.joined || !next.joined) return f;
    return {
      ...f,
      lat: (prev.lat + 2 * f.lat + next.lat) / 4,
      lon: (prev.lon + 2 * f.lon + next.lon) / 4,
    };
  });
}
