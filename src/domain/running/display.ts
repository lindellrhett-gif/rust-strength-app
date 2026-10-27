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

/**
 * How often the recording screen redraws the route and distance, by how many
 * fixes the run has (about one a second). Redrawing means re-cleaning the
 * whole track, which grows with the run, so a long run redraws less often to
 * save battery. The clock still ticks every second, and GPS recording in the
 * background is unaffected.
 */
export function liveRefreshMs(fixCount: number): number {
  if (fixCount < 3600) return 0; // under an hour: every fix
  if (fixCount < 7200) return 2000;
  return 5000;
}

/**
 * A route as an SVG path filling a `width` x `height` box with `padding`,
 * keeping its true shape (a degree of longitude is shorter than a degree of
 * latitude away from the equator). Null with fewer than two points.
 */
export function outlinePath(points: readonly LatLon[], width: number, height: number, padding = 8): string | null {
  if (points.length < 2 || width <= padding * 2 || height <= padding * 2) return null;
  const midLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = points.map((p) => p.lon * kx);
  const ys = points.map((p) => p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = Math.min((width - padding * 2) / (spanX || 1e-9), (height - padding * 2) / (spanY || 1e-9));
  // Centre the shape in whichever direction it doesn't fill.
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return xs
    .map((x, i) => {
      const px = offX + (x - minX) * scale;
      const py = height - (offY + (ys[i] - minY) * scale);
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join('');
}

/** GPS quality from the latest accuracy radius, for the status pill. */
export type GpsQuality = 'searching' | 'good' | 'weak';

export function gpsQuality(accuracyM: number | null | undefined): GpsQuality {
  if (accuracyM == null || !Number.isFinite(accuracyM)) return 'searching';
  if (accuracyM <= 20) return 'good';
  return 'weak';
}
