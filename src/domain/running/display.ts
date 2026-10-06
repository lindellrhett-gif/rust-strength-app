/**
 * Shaping a route for drawing on a map. Pure, no I/O.
 */

import type { LatLon } from './geo';
import type { CleanFix } from './types';

/** More points than this on screen only costs battery and frame rate. */
export const MAX_DRAWN_POINTS = 2000;

/**
 * The route as separate lines: one per unbroken stretch, so a manual pause or
 * a GPS jump is a gap on the map rather than a straight line across a park.
 * Long routes are thinned evenly, always keeping each stretch's ends.
 */
export function routeSegments(fixes: readonly CleanFix[], maxPoints = MAX_DRAWN_POINTS): LatLon[][] {
  const step = Math.max(1, Math.ceil(fixes.length / maxPoints));
  const segments: LatLon[][] = [];
  let current: LatLon[] = [];
  fixes.forEach((f, i) => {
    if (!f.joined && current.length > 0) {
      segments.push(current);
      current = [];
    }
    const next = fixes[i + 1];
    const endOfStretch = !next || !next.joined;
    if (current.length === 0 || endOfStretch || i % step === 0) current.push({ lat: f.lat, lon: f.lon });
  });
  if (current.length > 0) segments.push(current);
  return segments.filter((s) => s.length >= 2);
}

/** GPS quality from the latest accuracy radius, for the status pill. */
export type GpsQuality = 'searching' | 'good' | 'weak';

export function gpsQuality(accuracyM: number | null | undefined): GpsQuality {
  if (accuracyM == null || !Number.isFinite(accuracyM)) return 'searching';
  if (accuracyM <= 20) return 'good';
  return 'weak';
}
