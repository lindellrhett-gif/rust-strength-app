/**
 * Shaping a route for drawing on a map. Pure, no I/O.
 */

import type { LatLon } from './geo';
import type { CleanFix } from './types';

/** More points than this on screen only costs battery and frame rate. */
export const MAX_DRAWN_POINTS = 2000;

/** How much ground the map shows around you while you run: a few blocks. */
export const FOLLOW_SPAN_M = 600;
/** The smallest area a route map zooms to, so a short run isn't one street. */
export const MIN_ROUTE_SPAN_M = 300;

const METRES_PER_DEGREE_LAT = 111_320;

/** A map's visible area, in the shape react-native-maps takes it. */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** About `spanM` metres of map in each direction around a point. */
export function regionAround(p: LatLon, spanM = FOLLOW_SPAN_M): MapRegion {
  const cos = Math.max(0.01, Math.cos((p.lat * Math.PI) / 180));
  return {
    latitude: p.lat,
    longitude: p.lon,
    latitudeDelta: spanM / METRES_PER_DEGREE_LAT,
    longitudeDelta: spanM / (METRES_PER_DEGREE_LAT * cos),
  };
}

/**
 * The area that shows a whole route with a margin around it, never zoomed in
 * tighter than MIN_ROUTE_SPAN_M. Null without any points.
 */
export function regionForPoints(points: readonly LatLon[], padding = 1.3): MapRegion | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  const centre = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
  const floor = regionAround(centre, MIN_ROUTE_SPAN_M);
  return {
    latitude: centre.lat,
    longitude: centre.lon,
    latitudeDelta: Math.max(floor.latitudeDelta, (maxLat - minLat) * padding),
    longitudeDelta: Math.max(floor.longitudeDelta, (maxLon - minLon) * padding),
  };
}

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
