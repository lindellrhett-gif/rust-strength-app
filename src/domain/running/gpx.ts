/**
 * Reads GPX tracks into fixes. Used to replay recorded and simulated runs in
 * tests; kept in the app so importing a GPX file later needs nothing new.
 * Pure, no I/O.
 *
 * Reads <trkseg> (each one is a recording segment), <trkpt lat lon>, <ele>,
 * <time> and <hdop>. GPX has no accuracy radius, so horizontal dilution of
 * precision stands in for it at about 5 metres per unit, which is roughly what
 * a phone reports alongside the same HDOP.
 */

import type { GpsFix } from './types';

export const METRES_PER_HDOP = 5;

const attr = (tag: string, name: string): number => {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(tag);
  return m ? Number(m[1]) : NaN;
};

const child = (body: string, name: string): string | null => {
  const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(body);
  return m ? m[1].trim() : null;
};

export function parseGpx(xml: string): GpsFix[] {
  const fixes: GpsFix[] = [];
  const segments = xml.split(/<trkseg\b[^>]*>/).slice(1);
  segments.forEach((segment, seg) => {
    const body = segment.split('</trkseg>')[0];
    const pointRe = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
    for (let m = pointRe.exec(body); m; m = pointRe.exec(body)) {
      const inner = m[2] ?? '';
      const ele = child(inner, 'ele');
      const time = child(inner, 'time');
      const hdop = child(inner, 'hdop');
      const t = time ? Date.parse(time) : NaN;
      fixes.push({
        lat: attr(m[1], 'lat'),
        lon: attr(m[1], 'lon'),
        alt: ele != null && ele !== '' ? Number(ele) : null,
        t,
        accuracy: hdop != null && hdop !== '' ? Number(hdop) * METRES_PER_HDOP : null,
        seg,
      });
    }
  });
  return fixes;
}
