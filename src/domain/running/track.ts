/**
 * Turning clean fixes into a track with running distance and moving time.
 * Pure, no I/O.
 *
 * Moving time leaves out:
 *   - manual pauses, because nothing is recorded while paused;
 *   - with auto-pause on, any stretch slower than AUTO_PAUSE_SPEED_MPS that
 *     lasts AUTO_PAUSE_AFTER_S or longer, like waiting at a light.
 * A short slow moment, like a sharp turn, stays in. A stop shows up two
 * ways: an interval that is slow on average, or the filter seeing the phone
 * stand still (dropping fixes as jitter) for long enough.
 */

import { haversine } from './geo';
import type { CleanFix, TrackPoint } from './types';

/** Slower than this is standing still. A slow walk is about 1 m/s. */
export const AUTO_PAUSE_SPEED_MPS = 0.5;
/** A slow stretch this long or longer is a stop. */
export const AUTO_PAUSE_AFTER_S = 5;

export interface TrackOptions {
  autoPause: boolean;
}

interface Interval {
  joined: boolean;
  distance: number;
  seconds: number;
  slow: boolean;
  /** Seconds the phone was seen standing still inside this interval. */
  still: number;
}

export function buildTrack(fixes: readonly CleanFix[], opts: TrackOptions): TrackPoint[] {
  if (fixes.length === 0) return [];

  const intervals: Interval[] = [];
  for (let i = 1; i < fixes.length; i += 1) {
    const a = fixes[i - 1];
    const b = fixes[i];
    const seconds = Math.max(0, (b.t - a.t) / 1000);
    const distance = b.joined ? haversine(a, b) : 0;
    intervals.push({
      joined: b.joined,
      distance,
      seconds,
      slow: seconds > 0 && distance / seconds < AUTO_PAUSE_SPEED_MPS,
      still: Math.min(seconds, Math.max(0, (b.stillMs ?? 0) / 1000)),
    });
  }

  // A run of slow intervals is a stop only if it lasts long enough.
  const stopped = intervals.map(() => false);
  if (opts.autoPause) {
    let i = 0;
    while (i < intervals.length) {
      if (!intervals[i].joined || !intervals[i].slow) {
        i += 1;
        continue;
      }
      let j = i;
      let total = 0;
      while (j < intervals.length && intervals[j].joined && intervals[j].slow) {
        total += intervals[j].seconds;
        j += 1;
      }
      if (total >= AUTO_PAUSE_AFTER_S) for (let k = i; k < j; k += 1) stopped[k] = true;
      i = j;
    }
  }

  const first = fixes[0];
  const track: TrackPoint[] = [{ lat: first.lat, lon: first.lon, alt: first.alt, t: first.t, d: 0, mt: 0 }];
  let d = 0;
  let mt = 0;
  intervals.forEach((iv, k) => {
    if (iv.joined) {
      d += iv.distance;
      // A stop seen directly (fixes dropped as jitter for long enough) comes
      // out even when the interval as a whole averages just over stop speed.
      const seenStill = opts.autoPause && iv.still >= AUTO_PAUSE_AFTER_S ? iv.still : 0;
      if (!stopped[k]) mt += iv.seconds - seenStill;
    }
    const f = fixes[k + 1];
    track.push({ lat: f.lat, lon: f.lon, alt: f.alt, t: f.t, d, mt });
  });
  return track;
}

/** Total distance and moving time of a track. */
export function trackTotals(track: readonly TrackPoint[]): { distanceM: number; movingSeconds: number } {
  const last = track[track.length - 1];
  return { distanceM: last?.d ?? 0, movingSeconds: last ? Math.round(last.mt) : 0 };
}

/**
 * Where the track was at a given distance: the moving time and altitude at
 * that point, interpolated between the two fixes either side. Null past the
 * end of the track.
 */
export function atDistance(
  track: readonly TrackPoint[],
  metres: number,
): { mt: number; alt: number | null } | null {
  if (track.length === 0 || metres < 0 || metres > track[track.length - 1].d) return null;
  let lo = 0;
  let hi = track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].d < metres) lo = mid;
    else hi = mid;
  }
  const a = track[lo];
  const b = track[hi];
  if (metres <= a.d) return { mt: a.mt, alt: a.alt };
  const span = b.d - a.d;
  const f = span > 0 ? (metres - a.d) / span : 1;
  const alt = a.alt != null && b.alt != null ? a.alt + (b.alt - a.alt) * f : (b.alt ?? a.alt);
  return { mt: a.mt + (b.mt - a.mt) * f, alt };
}
