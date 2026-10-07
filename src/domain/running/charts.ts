/**
 * The pace and elevation charts on a run's summary, as points to draw.
 * Pure, no I/O.
 *
 * Both are sampled at even steps along the distance run, so a stop at a
 * light is a gap in time but not on the chart, and a long run costs no more
 * to draw than a short one.
 */

import { atDistance } from './track';
import type { TrackPoint } from './types';
import { METERS_PER, type RunDistanceUnit } from './units';

export interface ChartPoint {
  /** Distance so far, in miles or kilometres. */
  x: number;
  /** Seconds per mile or kilometre (pace), or metres (elevation). */
  y: number;
}

/** How many points a chart is drawn from. */
export const CHART_SAMPLES = 120;
/** Pace is averaged over this stretch, so GPS wobble doesn't look like surges. */
export const PACE_WINDOW_M = 200;
/** Slower than this many times the typical pace is a stop, not running. */
const PACE_OUTLIER_FACTOR = 2.5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Pace along the run, averaged over the last PACE_WINDOW_M at each sample.
 * Empty for a run too short to have a pace trend. Moments far slower than the
 * typical pace (a pause the runner forgot to press) are left out so they
 * don't flatten the rest of the chart.
 */
export function paceSeries(
  track: readonly TrackPoint[],
  unit: RunDistanceUnit,
  samples = CHART_SAMPLES,
): ChartPoint[] {
  const total = track[track.length - 1]?.d ?? 0;
  if (total < PACE_WINDOW_M * 2) return [];
  const step = (total - PACE_WINDOW_M) / Math.max(1, samples - 1);
  const raw: ChartPoint[] = [];
  for (let i = 0; i < samples; i += 1) {
    const at = PACE_WINDOW_M + i * step;
    const a = atDistance(track, at - PACE_WINDOW_M);
    const b = atDistance(track, Math.min(at, total));
    if (!a || !b) continue;
    const seconds = b.mt - a.mt;
    if (seconds <= 0) continue;
    raw.push({ x: at / METERS_PER[unit], y: (seconds / PACE_WINDOW_M) * METERS_PER[unit] });
  }
  if (raw.length < 2) return [];
  const typical = median(raw.map((p) => p.y));
  return raw.filter((p) => p.y <= typical * PACE_OUTLIER_FACTOR);
}

/** Altitude along the run, or empty when the run has none. */
export function elevationSeries(
  track: readonly TrackPoint[],
  unit: RunDistanceUnit,
  samples = CHART_SAMPLES,
): ChartPoint[] {
  const total = track[track.length - 1]?.d ?? 0;
  if (total <= 0 || track.every((p) => p.alt == null)) return [];
  const out: ChartPoint[] = [];
  for (let i = 0; i < samples; i += 1) {
    const at = (total * i) / Math.max(1, samples - 1);
    const alt = atDistance(track, at)?.alt;
    if (alt != null) out.push({ x: at / METERS_PER[unit], y: alt });
  }
  return out.length >= 2 ? out : [];
}

/** The lowest and highest y, for the axis labels and the VoiceOver summary. */
export function chartRange(points: readonly ChartPoint[]): { min: number; max: number } | null {
  if (points.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    min = Math.min(min, p.y);
    max = Math.max(max, p.y);
  }
  return { min, max };
}
