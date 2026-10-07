/**
 * Working with a saved run after the fact: the track its charts are drawn
 * from, and trimming its start or end. Pure, no I/O.
 *
 * A trimmed run is worked out exactly as it would have been on the day,
 * from the distance and moving time stored at every point, so its splits and
 * best efforts are real. Calories and steps can't be measured again, so they
 * are scaled: calories by distance kept, steps by moving time kept.
 */

import { bestEfforts } from './bestEfforts';
import type { RunDetail } from './detail';
import { elevationTotals } from './elevation';
import { haversine } from './geo';
import { MIN_SAVE_DISTANCE_M, splitsPayload } from './save';
import { computeSplits } from './splits';
import { plausibleSteps } from './steps';
import type { TrackPoint } from './types';
import { METERS_PER } from './units';

/**
 * The saved route as a track with distance and moving time at every point.
 * Runs saved before those were stored fall back to measuring the line and
 * counting all time as moving: fine for a chart, not for trimming.
 */
export function savedTrack(run: RunDetail): TrackPoint[] {
  const start = Date.parse(run.performedAt);
  let measured = 0;
  return run.route.map((p, i) => {
    if (i > 0) measured += haversine(run.route[i - 1], p);
    return {
      lat: p.lat,
      lon: p.lon,
      alt: p.alt,
      t: start + p.t * 1000,
      d: p.d ?? measured,
      mt: p.mt ?? p.t,
    };
  });
}

/** The point nearest to `metres` along the track, by distance run. */
export function indexAtDistance(track: readonly TrackPoint[], metres: number): number {
  if (track.length === 0) return 0;
  let lo = 0;
  let hi = track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].d < metres) lo = mid;
    else hi = mid;
  }
  return Math.abs(track[lo].d - metres) <= Math.abs(track[hi].d - metres) ? lo : hi;
}

/** How an effort rating reads: 1-3 easy, 4-6 moderate, 7-8 hard, 9-10 all out. */
export function effortLabel(effort: number): string {
  if (effort <= 3) return 'Easy';
  if (effort <= 6) return 'Moderate';
  if (effort <= 8) return 'Hard';
  return 'All out';
}

/** The arguments of rpc_crop_run (migration 0018). */
export interface CropInput {
  p_activity_id: string;
  /** First and last points kept, counting from 1. */
  p_from: number;
  p_to: number;
  p_distance_m: number;
  p_moving_seconds: number;
  p_elapsed_seconds: number;
  p_elevation_gain_m: number | null;
  p_elevation_loss_m: number | null;
  p_calories: number | null;
  p_splits: [number, number | null, number][];
  p_best_efforts: Record<string, number>;
  p_steps: number | null;
}

export type CropResult =
  | { ok: true; input: CropInput; track: TrackPoint[] }
  | { ok: false; reason: 'not-trimmable' | 'unchanged' | 'too-short' };

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The run kept between points `from` and `to` (counting from 0, inclusive),
 * ready to send, or why it can't be trimmed that way.
 */
export function cropRun(run: RunDetail, from: number, to: number): CropResult {
  if (!run.trimmable) return { ok: false, reason: 'not-trimmable' };
  const track = savedTrack(run);
  const first = Math.max(0, Math.min(from, track.length - 1));
  const last = Math.max(0, Math.min(to, track.length - 1));
  if (first === 0 && last === track.length - 1) return { ok: false, reason: 'unchanged' };
  if (last <= first) return { ok: false, reason: 'too-short' };

  const base = track[first];
  const kept = track.slice(first, last + 1).map((p) => ({ ...p, d: p.d - base.d, mt: p.mt - base.mt }));
  const end = kept[kept.length - 1];
  const distanceM = round1(end.d);
  const movingSeconds = Math.round(end.mt);
  if (distanceM < MIN_SAVE_DISTANCE_M || movingSeconds <= 0) return { ok: false, reason: 'too-short' };
  const elapsedSeconds = Math.max(movingSeconds, run.route[last].t - run.route[first].t);

  const elevation = run.hasElevation ? elevationTotals(kept) : null;
  const calories =
    run.calories != null && run.distanceM > 0 ? Math.round((run.calories * distanceM) / run.distanceM) : null;
  const steps =
    run.steps != null && run.movingSeconds > 0
      ? plausibleSteps((run.steps * movingSeconds) / run.movingSeconds, elapsedSeconds)
      : null;

  return {
    ok: true,
    track: kept,
    input: {
      p_activity_id: run.id,
      p_from: first + 1,
      p_to: last + 1,
      p_distance_m: distanceM,
      p_moving_seconds: movingSeconds,
      p_elapsed_seconds: elapsedSeconds,
      p_elevation_gain_m: elevation?.known ? round1(elevation.gainM) : null,
      p_elevation_loss_m: elevation?.known ? round1(elevation.lossM) : null,
      p_calories: calories,
      p_splits: splitsPayload(computeSplits(kept, METERS_PER[run.unit])),
      p_best_efforts: { ...bestEfforts(kept) } as Record<string, number>,
      p_steps: steps,
    },
  };
}
