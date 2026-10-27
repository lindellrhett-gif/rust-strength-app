/**
 * A saved run as the summary screen uses it, unpacked from rpc_get_run's
 * compact row. Pure, no I/O.
 */

import { EFFORT_KEYS, type BestEfforts } from './bestEfforts';
import type { LatLon } from './geo';
import { decodePolyline } from './polyline';
import type { SaveRunInput } from './save';
import type { RunDistanceUnit } from './units';

export interface RunSplit {
  seconds: number;
  elevationChangeM: number | null;
  distanceM: number;
}

export interface RoutePoint extends LatLon {
  /** Metres, when the run recorded altitude. */
  alt: number | null;
  /** Seconds from the first point. */
  t: number;
  /** Metres run so far, or null for runs saved before it was stored. */
  d: number | null;
  /** Moving seconds so far, or null for runs saved before it was stored. */
  mt: number | null;
}

export interface RunDetail {
  id: string;
  /** The title to show: the saved one, or "Run". */
  name: string;
  /** The title as saved, for editing. */
  title: string | null;
  note: string | null;
  performedAt: string;
  calories: number | null;
  /** Steps the phone counted during the run, when it could. */
  steps: number | null;
  /** Whether friends see it in their feed. */
  shareToFeed: boolean;
  unit: RunDistanceUnit;
  source: 'gps' | 'manual' | 'treadmill';
  distanceM: number;
  movingSeconds: number;
  elapsedSeconds: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  effort: number | null;
  splits: RunSplit[];
  hasElevation: boolean;
  mapVisibility: 'private' | 'friends';
  routeId: string | null;
  route: RoutePoint[];
  bestEfforts: BestEfforts;
  /** Whether the start and end can be trimmed: needs distance and moving time per point. */
  trimmable: boolean;
}

/** The fields of an rpc_get_run row. */
export interface RunRow {
  id: string;
  name: string | null;
  note: string | null;
  performed_at: string;
  calories: number | null;
  steps: number | null;
  share_to_feed?: boolean | null;
  distance_unit: string | null;
  source: 'gps' | 'manual' | 'treadmill';
  distance_m: number;
  moving_seconds: number;
  elapsed_seconds: number;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  effort: number | null;
  splits: unknown;
  has_elevation: boolean;
  map_visibility: 'private' | 'friends';
  route_id: string | null;
  polyline: string | null;
  alts: number[] | null;
  times: number[] | null;
  best_efforts: unknown;
  distances?: number[] | null;
  moving_times?: number[] | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function parseSplits(raw: unknown): RunSplit[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s) => {
    if (!Array.isArray(s)) return [];
    const seconds = num(s[0]);
    const distanceM = num(s[2]);
    if (seconds == null || distanceM == null) return [];
    return [{ seconds, elevationChangeM: num(s[1]), distanceM }];
  });
}

function parseEfforts(raw: unknown): BestEfforts {
  const out: BestEfforts = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of EFFORT_KEYS) {
    const v = num((raw as Record<string, unknown>)[key]);
    if (v != null && v > 0) out[key] = v;
  }
  return out;
}

function parseRoute(row: RunRow): RoutePoint[] {
  if (!row.polyline) return [];
  let points: LatLon[];
  try {
    points = decodePolyline(row.polyline);
  } catch {
    return [];
  }
  // Per-point distance and moving time only count if there is one for every point.
  const perPoint = (a: number[] | null | undefined) => (a && a.length === points.length ? a : null);
  const distances = perPoint(row.distances);
  const moving = perPoint(row.moving_times);
  return points.map((p, i) => ({
    ...p,
    alt: row.has_elevation ? (row.alts?.[i] ?? null) : null,
    t: row.times?.[i] ?? 0,
    d: distances && moving ? distances[i] : null,
    mt: distances && moving ? moving[i] : null,
  }));
}

export function parseRunRow(row: RunRow): RunDetail {
  const route = parseRoute(row);
  return {
    id: row.id,
    name: row.name?.trim() || 'Run',
    title: row.name?.trim() || null,
    note: row.note,
    performedAt: row.performed_at,
    calories: row.calories,
    steps: num(row.steps),
    shareToFeed: row.share_to_feed ?? true,
    unit: row.distance_unit === 'km' ? 'km' : 'mi',
    source: row.source,
    distanceM: row.distance_m,
    movingSeconds: row.moving_seconds,
    elapsedSeconds: row.elapsed_seconds,
    elevationGainM: row.elevation_gain_m,
    elevationLossM: row.elevation_loss_m,
    effort: row.effort,
    splits: parseSplits(row.splits),
    hasElevation: row.has_elevation,
    mapVisibility: row.map_visibility,
    routeId: row.route_id,
    route,
    bestEfforts: parseEfforts(row.best_efforts),
    trimmable: route.length >= 2 && route.every((p) => p.d != null && p.mt != null),
  };
}

/**
 * The row rpc_get_run will return once a save goes through. Lets the summary
 * show a run that is still waiting in the offline queue, exactly as it will
 * look when it arrives.
 */
export function runRowFromSave(input: SaveRunInput): RunRow {
  return {
    id: input.p_id,
    name: input.p_name,
    note: input.p_note,
    performed_at: input.p_performed_at,
    calories: input.p_calories,
    steps: input.p_steps,
    distance_unit: input.p_distance_unit,
    source: input.p_source,
    distance_m: input.p_distance_m,
    moving_seconds: input.p_moving_seconds,
    elapsed_seconds: input.p_elapsed_seconds,
    elevation_gain_m: input.p_elevation_gain_m,
    elevation_loss_m: input.p_elevation_loss_m,
    effort: input.p_effort,
    splits: input.p_splits,
    has_elevation: input.p_alts != null,
    map_visibility: input.p_map_visibility,
    route_id: input.p_route_id,
    polyline: input.p_polyline,
    alts: input.p_alts,
    times: input.p_times,
    best_efforts: input.p_best_efforts,
    distances: input.p_distances,
    moving_times: input.p_moving_times,
  };
}
