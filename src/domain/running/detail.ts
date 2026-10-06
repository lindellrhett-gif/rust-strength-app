/**
 * A saved run as the summary screen uses it, unpacked from rpc_get_run's
 * compact row. Pure, no I/O.
 */

import { EFFORT_KEYS, type BestEfforts } from './bestEfforts';
import type { LatLon } from './geo';
import { decodePolyline } from './polyline';
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
}

export interface RunDetail {
  id: string;
  name: string;
  note: string | null;
  performedAt: string;
  calories: number | null;
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
}

/** The fields of an rpc_get_run row. */
export interface RunRow {
  id: string;
  name: string | null;
  note: string | null;
  performed_at: string;
  calories: number | null;
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
  return points.map((p, i) => ({
    ...p,
    alt: row.has_elevation ? (row.alts?.[i] ?? null) : null,
    t: row.times?.[i] ?? 0,
  }));
}

export function parseRunRow(row: RunRow): RunDetail {
  return {
    id: row.id,
    name: row.name?.trim() || 'Run',
    note: row.note,
    performedAt: row.performed_at,
    calories: row.calories,
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
    route: parseRoute(row),
    bestEfforts: parseEfforts(row.best_efforts),
  };
}
