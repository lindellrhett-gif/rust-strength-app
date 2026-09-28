/**
 * Distance, pace and elevation units for runs. Pure, no I/O.
 *
 * The app has one unit setting, for weight. Distance follows it: pounds means
 * miles and feet, kilograms means kilometres and metres. Everything is stored
 * in metres and seconds; units only matter on screen and for splits.
 */

import { formatClock } from '../duration';

export type RunDistanceUnit = 'mi' | 'km';

export const METERS_PER: Record<RunDistanceUnit, number> = {
  mi: 1609.344,
  km: 1000,
};

const FEET_PER_METER = 3.280_839_895;

/** The distance unit that goes with a weight unit. */
export function runUnitFor(weightUnit: 'lb' | 'kg'): RunDistanceUnit {
  return weightUnit === 'kg' ? 'km' : 'mi';
}

export function toUnit(metres: number, unit: RunDistanceUnit): number {
  return metres / METERS_PER[unit];
}

export function fromUnit(value: number, unit: RunDistanceUnit): number {
  return value * METERS_PER[unit];
}

/** "3.12 mi". Never negative, never NaN. */
export function formatDistance(metres: number, unit: RunDistanceUnit, digits = 2): string {
  const v = Number.isFinite(metres) && metres > 0 ? toUnit(metres, unit) : 0;
  return `${v.toFixed(digits)} ${unit}`;
}

/** Below this distance a pace is noise, so none is shown. */
export const MIN_PACE_DISTANCE_M = 10;

/** Seconds per mile or kilometre, or null when there is too little to say. */
export function paceSeconds(
  metres: number,
  seconds: number,
  unit: RunDistanceUnit,
): number | null {
  if (!(metres >= MIN_PACE_DISTANCE_M) || !(seconds > 0)) return null;
  return (seconds / metres) * METERS_PER[unit];
}

/** "8:05 /mi", or "--:-- /mi" when there is no pace yet. */
export function formatPace(secondsPerUnit: number | null, unit: RunDistanceUnit): string {
  if (secondsPerUnit == null || !Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) {
    return `--:-- /${unit}`;
  }
  // Slower than 99 minutes a mile is standing still, not a pace.
  if (secondsPerUnit >= 99 * 60) return `--:-- /${unit}`;
  return `${formatClock(Math.round(secondsPerUnit))} /${unit}`;
}

/** Elevation in feet for miles, metres for kilometres: "412 ft". */
export function formatElevation(metres: number, unit: RunDistanceUnit): string {
  const safe = Number.isFinite(metres) ? Math.max(0, metres) : 0;
  return unit === 'mi'
    ? `${Math.round(safe * FEET_PER_METER).toLocaleString('en-US')} ft`
    : `${Math.round(safe).toLocaleString('en-US')} m`;
}

/** Converts a bodyweight in the app's unit to kilograms. */
export function toKilograms(weight: number, unit: 'lb' | 'kg'): number {
  return unit === 'kg' ? weight : weight * 0.453_592_37;
}
