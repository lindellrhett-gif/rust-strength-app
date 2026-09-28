/**
 * From raw fixes to everything the run summary and the database need, in one
 * call, plus the live numbers shown while recording. Pure, no I/O.
 */

import { bestEfforts, type BestEfforts } from './bestEfforts';
import { estimateCalories } from './calories';
import { elevationTotals, fillAltitudes } from './elevation';
import { filterFixes, type FilterReport } from './filter';
import { encodePolyline } from './polyline';
import { elapsedMs, recordingMs, type RecorderState } from './recorder';
import { computeSplits, type Split } from './splits';
import { AUTO_PAUSE_AFTER_S, buildTrack, trackTotals } from './track';
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
  const track = buildTrack(report.fixes, { autoPause: opts.autoPause });
  const { distanceM } = trackTotals(track);
  const end = recorder.finishedAt ?? track[track.length - 1]?.t ?? 0;
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
  /** True while auto-pause thinks you have stopped. */
  autoPaused: boolean;
}

export function liveStats(
  fixes: readonly GpsFix[],
  recorder: RecorderState,
  now: number,
  opts: { autoPause: boolean; unit: RunDistanceUnit },
): LiveStats {
  const track = buildTrack(filterFixes(fixes).fixes, { autoPause: opts.autoPause });
  const last = track[track.length - 1];
  const distanceM = last?.d ?? 0;
  const recording = recorder.status === 'recording';

  // With auto-pause, no new fix for a while means standing still: the phone
  // only reports again once you have moved a few metres.
  const sinceLast = last ? Math.max(0, (now - last.t) / 1000) : 0;
  const autoPaused = opts.autoPause && recording && last != null && sinceLast >= AUTO_PAUSE_AFTER_S;

  let movingSeconds: number;
  if (!opts.autoPause) movingSeconds = recordingMs(recorder, now) / 1000;
  else movingSeconds = (last?.mt ?? 0) + (recording && !autoPaused ? sinceLast : 0);

  let currentPace: number | null = null;
  if (last && !autoPaused) {
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
  };
}
