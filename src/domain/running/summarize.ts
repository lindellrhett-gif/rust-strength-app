/**
 * From raw fixes to everything the run summary and the database need, in one
 * call, plus the live numbers shown while recording. Pure, no I/O.
 */

import { bestEfforts, type BestEfforts } from './bestEfforts';
import { estimateCalories } from './calories';
import { elevationTotals, fillAltitudes } from './elevation';
import { filterFixes, type FilterReport } from './filter';
import { encodePolyline } from './polyline';
import { elapsedMs, recordingMs, segmentStartedAt, type RecorderState } from './recorder';
import { computeSplits, type Split } from './splits';
import { findStops } from './stops';
import { buildTrack, stoppedMs, trackTotals, type Stop } from './track';
import type { GpsFix, TrackPoint } from './types';
import { METERS_PER, paceSeconds, type RunDistanceUnit } from './units';

export interface SummaryOptions {
  autoPause: boolean;
  unit: RunDistanceUnit;
  bodyweightKg: number | null;
}

export interface RunSummary {
  distanceM: number;
  movingSeconds: number;
  elapsedSeconds: number;
  /** Seconds per mile or kilometre, or null for a run too short to say. */
  averagePace: number | null;
  elevationGainM: number;
  elevationLossM: number;
  hasElevation: boolean;
  splits: Split[];
  bestEfforts: BestEfforts;
  calories: number | null;
  track: TrackPoint[];
  rejected: FilterReport['rejected'];
}

export function summarizeRun(
  fixes: readonly GpsFix[],
  recorder: RecorderState,
  opts: SummaryOptions,
): RunSummary {
  const report = filterFixes(fixes);
  const end = recorder.finishedAt ?? report.fixes[report.fixes.length - 1]?.t ?? 0;
  const { stops } = findStops(report.motion, end);
  const track = buildTrack(report.fixes, { autoPause: opts.autoPause, stops });
  const { distanceM } = trackTotals(track);
  const elapsedSeconds = Math.round(elapsedMs(recorder, end) / 1000);
  // Without auto-pause, moving time is simply time spent recording.
  const rawMoving = opts.autoPause ? trackTotals(track).movingSeconds : recordingMs(recorder, end) / 1000;
  const movingSeconds = Math.min(Math.round(rawMoving), elapsedSeconds);
  const elevation = elevationTotals(track);

  return {
    distanceM,
    movingSeconds,
    elapsedSeconds,
    averagePace: paceSeconds(distanceM, movingSeconds, opts.unit),
    elevationGainM: elevation.gainM,
    elevationLossM: elevation.lossM,
    hasElevation: elevation.known,
    splits: computeSplits(track, METERS_PER[opts.unit]),
    bestEfforts: bestEfforts(track),
    calories: estimateCalories({
      distanceM,
      movingSeconds,
      elevationGainM: elevation.gainM,
      bodyweightKg: opts.bodyweightKg,
    }),
    track,
    rejected: report.rejected,
  };
}

/** A route as the database takes it: one polyline and two parallel arrays. */
export interface RoutePayload {
  polyline: string;
  /** Altitude per point in metres, or null when the run has none. */
  alts: number[] | null;
  /** Seconds from the first point, per point. */
  times: number[];
}

export function routePayload(track: readonly TrackPoint[]): RoutePayload | null {
  if (track.length < 2) return null;
  const t0 = track[0].t;
  const alts = fillAltitudes(track.map((p) => p.alt));
  return {
    polyline: encodePolyline(track),
    alts: alts ? alts.map((a) => Math.round(a * 10) / 10) : null,
    times: track.map((p) => Math.max(0, Math.round((p.t - t0) / 1000))),
  };
}

// ---------------------------------------------------------------------------
// Live numbers while recording
// ---------------------------------------------------------------------------

/** Current pace looks back over this much moving time. */
export const CURRENT_PACE_WINDOW_S = 30;

export interface LiveStats {
  distanceM: number;
  /** The big clock: time spent moving. */
  movingSeconds: number;
  elapsedSeconds: number;
  currentPace: number | null;
  averagePace: number | null;
  /** True once auto-pause is sure you have stopped: the "Auto-paused" label. */
  autoPaused: boolean;
  /**
   * True while the clock is held: stopped for sure, or the phone's speed
   * reading has just dropped to standing and auto-pause is making up its
   * mind. If you move off again within a few seconds, the held time comes
   * back.
   */
  holding: boolean;
}

export function liveStats(
  fixes: readonly GpsFix[],
  recorder: RecorderState,
  now: number,
  opts: { autoPause: boolean; unit: RunDistanceUnit },
): LiveStats {
  const report = filterFixes(fixes);
  const { stops, pending } = findStops(report.motion, now);
  const track = buildTrack(report.fixes, { autoPause: opts.autoPause, stops });
  const last = track[track.length - 1];
  const distanceM = last?.d ?? 0;
  const recording = recorder.status === 'recording';

  // No new fix is not the same as standing still: a tunnel or a tall
  // building drops the signal mid-stride. Only evidence of standing still
  // pauses the clock.
  const autoPaused = opts.autoPause && recording && stops.length > 0 && stops[stops.length - 1].open;
  const held: Stop[] = opts.autoPause && recording && pending?.measured ? [...stops, pending] : stops;
  const holding = autoPaused || held !== stops;

  let movingSeconds: number;
  if (!opts.autoPause) movingSeconds = recordingMs(recorder, now) / 1000;
  else {
    movingSeconds = last?.mt ?? 0;
    if (recording && last) {
      // Time since the last clean fix, but not from before a manual resume
      // and not while standing still.
      const from = Math.max(last.t, segmentStartedAt(recorder) ?? last.t);
      movingSeconds += Math.max(0, (now - from - stoppedMs(held, from, now)) / 1000);
    }
  }

  let currentPace: number | null = null;
  if (last && !holding) {
    let k = track.length - 1;
    while (k > 0 && last.mt - track[k].mt < CURRENT_PACE_WINDOW_S) k -= 1;
    currentPace = paceSeconds(last.d - track[k].d, last.mt - track[k].mt, opts.unit);
  }

  return {
    distanceM,
    movingSeconds: Math.floor(movingSeconds),
    elapsedSeconds: Math.floor(elapsedMs(recorder, now) / 1000),
    currentPace,
    averagePace: paceSeconds(distanceM, movingSeconds, opts.unit),
    autoPaused,
    holding,
  };
}
