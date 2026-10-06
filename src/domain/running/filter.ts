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
 *      When the phone's own speed reading says it is standing still, the
 *      whole accuracy radius counts as jitter. Time still passes, so a long
 *      stop shows up as a slow interval and auto-pause can take it out of
 *      moving time.
 *   4. Smooth what is left lightly, which takes the zig-zag out of a straight
 *      line without cutting corners.
 *
 * A signal gap, like a tunnel, needs no special case: the fix after it joins
 * the one before with a straight line if running that far in that time was
 * possible, and is treated as a spike otherwise.
 *
 * Alongside the clean fixes it reports what every usable fix says about
 * moving (see MotionSample), which is what auto-pause works from.
 */

import { haversine, isValidCoord } from './geo';
import { AUTO_PAUSE_SPEED_MPS } from './track';
import type { CleanFix, GpsFix, MotionSample } from './types';

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
/** Longer than this between usable fixes is a gap in the signal. */
export const SIGNAL_GAP_S = 10;

export interface FilterReport {
  fixes: CleanFix[];
  /** One per usable fix, in time order. */
  motion: MotionSample[];
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

/** The phone's measured speed, or null when it gave none. */
export function measuredSpeed(f: GpsFix): number | null {
  return f.speed != null && Number.isFinite(f.speed) && f.speed >= 0 ? f.speed : null;
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
  const motion: MotionSample[] = [];
  /** Consecutive spike-rejected fixes that agree with one another. */
  let pending: GpsFix[] = [];
  /** Index in `kept` where the current unbroken stretch began. */
  let stretchStart = 0;
  /** Every fix since the last kept one had a speed reading, with no gap. */
  let covered = true;

  /**
   * Records what a fix says about moving. The phone's speed reading decides
   * when there is one; otherwise `fallback` does, from the positions.
   */
  const sample = (fix: GpsFix, fallback: MotionSample['state']) => {
    const v = measuredSpeed(fix);
    const prev = motion[motion.length - 1];
    covered = covered && v != null && (!prev || fix.t - prev.t <= SIGNAL_GAP_S * 1000);
    motion.push(
      v != null
        ? { t: fix.t, seg: fix.seg, state: v < AUTO_PAUSE_SPEED_MPS ? 'still' : 'moving', measured: true }
        : { t: fix.t, seg: fix.seg, state: fallback, measured: false },
    );
  };

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
      sample(fix, 'unsure');
      covered = true;
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
      stretchStart = kept.length;
      kept.push({ ...fix, joined: false });
      sample(fix, 'unsure');
      covered = true;
      continue;
    }

    if (speed(last, fix) > MAX_SPEED_MPS) {
      sample(fix, 'unsure');
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
        covered = false;
      }
      continue;
    }
    pending = [];

    const v = measuredSpeed(fix);
    const standing = v != null && v < AUTO_PAUSE_SPEED_MPS;
    const accuracy = Math.min(MAX_ACCURACY_M, Math.max(last.accuracy ?? 0, fix.accuracy ?? 0));
    const radius = standing ? Math.max(stillRadius(last, fix), accuracy) : stillRadius(last, fix);
    if (haversine(last, fix) < radius) {
      rejected.stationary += 1;
      // Only evidence of standing still if there was no progress either: a
      // slow walk also drops a fix or two, but it keeps getting further away.
      sample(fix, speed(last, fix) < AUTO_PAUSE_SPEED_MPS ? 'still' : 'unsure');
      continue;
    }
    sample(fix, 'moving');
    kept.push({ ...fix, joined: true, measured: covered });
    covered = true;
  }

  return { fixes: smooth(kept), motion, rejected };
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
