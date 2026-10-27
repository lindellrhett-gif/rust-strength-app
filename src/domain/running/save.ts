/**
 * Turning a finished recording into what the database takes, and deciding
 * whether there is anything worth saving. Pure, no I/O.
 */

import type { Split } from './splits';
import { plausibleSteps } from './steps';
import { routePayload, type RunSummary } from './summarize';
import type { RunDistanceUnit } from './units';

/** Runs shorter than this are almost always a mis-tap; the screen offers to discard. */
export const MIN_SAVE_DISTANCE_M = 50;

/** A default title from the time of day the run started: "Morning run". */
export function defaultRunName(startedAt: Date): string {
  const h = startedAt.getHours();
  if (h >= 4 && h < 11) return 'Morning run';
  if (h >= 11 && h < 14) return 'Lunch run';
  if (h >= 14 && h < 17) return 'Afternoon run';
  if (h >= 17 && h < 21) return 'Evening run';
  return 'Night run';
}

/** The arguments of rpc_save_run (migrations 0015, 0017, 0018 and 0022). */
export interface SaveRunInput {
  p_id: string;
  p_performed_at: string;
  p_source: 'gps' | 'manual' | 'treadmill';
  p_distance_m: number;
  p_moving_seconds: number;
  p_elapsed_seconds: number;
  p_distance_unit: RunDistanceUnit;
  p_name: string | null;
  p_note: string | null;
  p_elevation_gain_m: number | null;
  p_elevation_loss_m: number | null;
  p_calories: number | null;
  p_effort: number | null;
  /** [[seconds, elevation change or null, distance], ...] */
  p_splits: [number, number | null, number][];
  p_polyline: string | null;
  p_alts: number[] | null;
  p_times: number[] | null;
  p_best_efforts: Record<string, number>;
  p_map_visibility: 'private' | 'friends';
  p_steps: number | null;
  /** Metres so far at each route point. */
  p_distances: number[] | null;
  /** Moving seconds so far at each route point. */
  p_moving_times: number[] | null;
  /** The saved route this run followed, if any. */
  p_route_id: string | null;
}

export interface RecordedRunMeta {
  runId: string;
  startedAt: number;
  unit: RunDistanceUnit;
  mapVisibility: 'private' | 'friends';
  /** Steps the phone counted while recording, when it could. */
  steps?: number | null;
  /** The saved route the runner chose to follow. */
  routeId?: string | null;
}

/**
 * Why a recording can't be saved as it stands, or null if it can. The screen
 * turns each reason into a choice for the runner.
 */
export function unsavableReason(summary: RunSummary): 'too-short' | 'no-route' | null {
  if (!(summary.distanceM >= MIN_SAVE_DISTANCE_M) || !(summary.movingSeconds > 0)) return 'too-short';
  if (summary.track.length < 2) return 'no-route';
  return null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Splits as the database stores them: [seconds, elevation change or null, distance]. */
export function splitsPayload(splits: readonly Split[]): [number, number | null, number][] {
  return splits.map((s) => [
    Math.round(s.seconds),
    s.elevationChangeM == null ? null : round1(s.elevationChangeM),
    round1(s.distanceM),
  ]);
}

/** Builds the save for a recorded run. Throws if the run is not savable. */
export function buildSaveRunInput(summary: RunSummary, meta: RecordedRunMeta): SaveRunInput {
  const reason = unsavableReason(summary);
  if (reason) throw new Error(`Run cannot be saved: ${reason}`);
  const route = routePayload(summary.track);
  if (!route) throw new Error('Run cannot be saved: no-route');

  return {
    p_id: meta.runId,
    p_performed_at: new Date(meta.startedAt).toISOString(),
    p_source: 'gps',
    p_distance_m: round1(summary.distanceM),
    p_moving_seconds: Math.max(1, summary.movingSeconds),
    p_elapsed_seconds: Math.max(summary.movingSeconds, summary.elapsedSeconds, 1),
    p_distance_unit: meta.unit,
    p_name: defaultRunName(new Date(meta.startedAt)),
    p_note: null,
    p_elevation_gain_m: summary.hasElevation ? round1(summary.elevationGainM) : null,
    p_elevation_loss_m: summary.hasElevation ? round1(summary.elevationLossM) : null,
    p_calories: summary.calories,
    p_effort: null,
    p_splits: splitsPayload(summary.splits),
    p_polyline: route.polyline,
    p_alts: route.alts,
    p_times: route.times,
    p_best_efforts: { ...summary.bestEfforts } as Record<string, number>,
    p_map_visibility: meta.mapVisibility,
    p_steps: plausibleSteps(meta.steps, summary.elapsedSeconds),
    p_distances: route.distances,
    p_moving_times: route.moving,
    p_route_id: meta.routeId ?? null,
  };
}
