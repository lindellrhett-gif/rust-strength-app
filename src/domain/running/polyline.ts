/**
 * Encoded polylines: the compact text format for routes (Google's algorithm,
 * five decimal places, about a metre). PostGIS reads and writes the same
 * format with ST_LineFromEncodedPolyline and ST_AsEncodedPolyline, so a route
 * travels to and from the database as one short string instead of thousands of
 * rows. Pure, no I/O.
 */

import type { LatLon } from './geo';

const PRECISION = 1e5;

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

export function encodePolyline(points: readonly LatLon[]): string {
  let prevLat = 0;
  let prevLon = 0;
  let out = '';
  for (const p of points) {
    const lat = Math.round(p.lat * PRECISION);
    const lon = Math.round(p.lon * PRECISION);
    out += encodeValue(lat - prevLat) + encodeValue(lon - prevLon);
    prevLat = lat;
    prevLon = lon;
  }
  return out;
}

/** Decodes a polyline. Throws on text that is not a well-formed polyline. */
export function decodePolyline(text: string): LatLon[] {
  const points: LatLon[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  const next = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= text.length) throw new Error('Truncated polyline');
      byte = text.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error('Invalid polyline character');
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < text.length) {
    lat += next();
    lon += next();
    points.push({ lat: lat / PRECISION, lon: lon / PRECISION });
  }
  return points;
}
