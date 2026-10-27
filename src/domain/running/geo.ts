/**
 * Distances on the Earth's surface. Pure, no I/O.
 */

/** Mean Earth radius in metres (IUGG). */
export const EARTH_RADIUS_M = 6_371_008.8;

const RAD = Math.PI / 180;

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Great-circle distance in metres between two points (haversine). Accurate to
 * well under a metre over the few metres between two GPS fixes, which is all a
 * run needs.
 */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** True for a real coordinate: finite, in range, and not the 0,0 "null island". */
export function isValidCoord(p: LatLon): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lon >= -180 &&
    p.lon <= 180 &&
    !(p.lat === 0 && p.lon === 0)
  );
}

/**
 * The point `metres` along a bearing from `from`. Used to build test tracks;
 * the app itself never needs to project points.
 */
export function offset(from: LatLon, metres: number, bearingDeg: number): LatLon {
  const d = metres / EARTH_RADIUS_M;
  const brg = bearingDeg * RAD;
  const lat1 = from.lat * RAD;
  const lon1 = from.lon * RAD;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: lat2 / RAD, lon: lon2 / RAD };
}
