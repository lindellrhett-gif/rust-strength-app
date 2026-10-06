/**
 * Auto-pause: finding where the runner stopped. Pure, no I/O.
 *
 * Works from the motion samples filterFixes reports, one per usable fix. A
 * stop is a stretch of 'still' samples with no 'moving' sample inside it,
 * lasting AUTO_PAUSE_AFTER_S or longer.
 *
 *   - It begins at the last sign of movement before it. Without the phone's
 *     speed reading, standing still only shows up a few seconds after it
 *     starts (the fixes need time to prove they are going nowhere), so the
 *     stop is dated back to when the movement ended.
 *   - It ends at the last sign of standing still.
 *   - A signal gap inside a stop is part of the stop. A gap while moving is
 *     not, so running through a tunnel stays moving time.
 *   - A manual pause ends any stop; the next segment starts fresh.
 */

import { AUTO_PAUSE_AFTER_S, type Stop } from './track';
import type { MotionSample } from './types';

export type { Stop };

export interface StopReport {
  stops: Stop[];
  /**
   * A still stretch at the very end that is not yet long enough to be a
   * stop. `measured` says whether the phone's speed reading saw it, which is
   * what makes it trustworthy enough to hold the live clock.
   */
  pending: (Stop & { measured: boolean }) | null;
}

/**
 * @param until When the record ends: now while recording, or the finish
 *   time. A stillness still going at the end runs up to it.
 */
export function findStops(
  samples: readonly MotionSample[],
  until: number | null = null,
  minSeconds: number = AUTO_PAUSE_AFTER_S,
): StopReport {
  const minMs = minSeconds * 1000;
  const stops: Stop[] = [];
  let seg: number | null = null;
  /** The latest sign of movement in this segment. */
  let anchor = 0;
  /** The still stretch under way, if any. */
  let run = null as { start: number; lastStill: number; measured: boolean } | null;

  for (const s of samples) {
    const ends = s.seg !== seg || s.state === 'moving';
    if (ends && run) {
      if (run.lastStill - run.start >= minMs) stops.push({ start: run.start, end: run.lastStill, open: false });
      run = null;
    }
    if (ends) anchor = s.t;
    seg = s.seg;
    if (s.state === 'still') {
      if (run) {
        run.lastStill = s.t;
        run.measured = s.measured;
      } else {
        run = { start: Math.min(anchor, s.t), lastStill: s.t, measured: s.measured };
      }
    }
  }

  if (!run) return { stops, pending: null };
  const end = Math.max(run.lastStill, until ?? run.lastStill);
  if (end - run.start >= minMs) return { stops: [...stops, { start: run.start, end, open: true }], pending: null };
  return { stops, pending: { start: run.start, end, open: true, measured: run.measured } };
}
