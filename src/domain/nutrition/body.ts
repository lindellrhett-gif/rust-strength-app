/**
 * Weight, height and water in the person's own units, and the weight trend.
 * Pure, no I/O.
 *
 * Everything is stored metric (kg, cm, ml). Someone whose profile is in
 * pounds sees pounds, feet and inches, and fluid ounces; in kilograms, they
 * see kilograms, centimetres and millilitres. Water uses the conversions US
 * nutrition labels use (1 fl oz = 30 ml, 1 cup = 240 ml), so a cup is 8 fl oz
 * exactly.
 */

import { ML_PER_CUP, validWeighInKg, type WeighIn } from './settings';

export type WeightUnit = 'lb' | 'kg';

export const LB_PER_KG = 2.20462;
export const CM_PER_INCH = 2.54;
export const ML_PER_FL_OZ = 30;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A number as typed, commas for decimals too. NaN for anything else. */
function typedNumber(typed: string): number {
  const t = typed.trim().replace(',', '.');
  return t === '' || !/^\d*\.?\d+$|^\d+\.$/.test(t) ? NaN : Number(t);
}

// --- Weight ----------------------------------------------------------------------

/** Kilograms in the person's unit, to one decimal. */
export function weightIn(kg: number, unit: WeightUnit): number {
  return round1(unit === 'lb' ? kg * LB_PER_KG : kg);
}

export function kgFrom(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

/** "182.4 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${weightIn(kg, unit)} ${unit}`;
}

/** A weight as typed in the person's unit, in kg; null unless it is a plausible bodyweight. */
export function parseWeight(typed: string, unit: WeightUnit): number | null {
  const value = typedNumber(typed);
  if (!Number.isFinite(value)) return null;
  const kg = kgFrom(value, unit);
  return validWeighInKg(kg) ? kg : null;
}

/** "−1.2 lb", "+0.4 kg", "0 lb": a change, signed. */
export function formatWeightChange(kg: number, unit: WeightUnit): string {
  const v = weightIn(Math.abs(kg), unit);
  if (v === 0) return `0 ${unit}`;
  return `${kg < 0 ? '−' : '+'}${v} ${unit}`;
}

// --- Height ----------------------------------------------------------------------

export const MIN_HEIGHT_CM = 50;
export const MAX_HEIGHT_CM = 272;

/** Centimetres as whole feet and inches, the inches rounded. */
export function feetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

/** Height as typed: centimetres, or feet and inches (inches may be blank). Null unless plausible. */
export function parseHeight(
  typed: { cm: string } | { feet: string; inches: string },
): number | null {
  let cm: number;
  if ('cm' in typed) {
    cm = typedNumber(typed.cm);
  } else {
    const feet = typedNumber(typed.feet);
    const inches = typed.inches.trim() === '' ? 0 : typedNumber(typed.inches);
    if (!Number.isInteger(feet) || !(inches >= 0 && inches < 12)) return null;
    cm = (feet * 12 + inches) * CM_PER_INCH;
  }
  return Number.isFinite(cm) && cm >= MIN_HEIGHT_CM && cm <= MAX_HEIGHT_CM ? round1(cm) : null;
}

// --- Water -----------------------------------------------------------------------

/** Water in the person's unit: fl oz with pounds, ml with kilograms. */
export function waterUnitFor(unit: WeightUnit): 'floz' | 'ml' {
  return unit === 'lb' ? 'floz' : 'ml';
}

/** "64 fl oz", "2,000 ml". */
export function formatWater(ml: number, unit: WeightUnit): string {
  if (waterUnitFor(unit) === 'floz') return `${round1(ml / ML_PER_FL_OZ).toLocaleString('en-US')} fl oz`;
  return `${Math.round(ml).toLocaleString('en-US')} ml`;
}

/** The value a water field shows for `ml`. */
export function waterIn(ml: number, unit: WeightUnit): number {
  return waterUnitFor(unit) === 'floz' ? round1(ml / ML_PER_FL_OZ) : Math.round(ml);
}

/** A water amount as typed in the person's unit, in ml; null for blank or nonsense. */
export function parseWater(typed: string, unit: WeightUnit): number | null {
  const value = typedNumber(typed);
  if (!(value > 0)) return null;
  return Math.round(waterUnitFor(unit) === 'floz' ? value * ML_PER_FL_OZ : value);
}

/** One-tap water amounts on the diary. */
export function waterButtons(unit: WeightUnit): { label: string; ml: number }[] {
  return waterUnitFor(unit) === 'floz'
    ? [
        { label: '1 cup', ml: ML_PER_CUP },
        { label: '16 fl oz', ml: 16 * ML_PER_FL_OZ },
      ]
    : [
        { label: '250 ml', ml: 250 },
        { label: '500 ml', ml: 500 },
      ];
}

/** The goal a water setting starts at when nobody has set one: 8 cups, or 2 litres. */
export function suggestedWaterGoalMl(unit: WeightUnit): number {
  return waterUnitFor(unit) === 'floz' ? 8 * ML_PER_CUP : 2000;
}

// --- Trend -----------------------------------------------------------------------

export interface TrendPoint {
  day: string;
  kg: number;
  /** The smoothed weight on that day. */
  trendKg: number;
}

/**
 * How much of each day's difference the trend takes in: a tenth, the usual
 * figure for a smoothed weight trend. Day-to-day water and food swings mostly
 * wash out; a real change shows within a couple of weeks.
 */
export const TREND_SMOOTHING = 0.1;

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * Weigh-ins oldest first with a smoothed trend. A gap of several days counts
 * as several days of smoothing, so a weigh-in after a week away moves the
 * trend about as far as a week of daily ones would.
 */
export function weightTrend(weighIns: readonly WeighIn[]): TrendPoint[] {
  const sorted = [...weighIns].filter((w) => validWeighInKg(w.kg)).sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
  const out: TrendPoint[] = [];
  for (const w of sorted) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({ day: w.measuredOn, kg: w.kg, trendKg: w.kg });
      continue;
    }
    const gap = Math.max(1, dayNumber(w.measuredOn) - dayNumber(prev.day));
    const keep = (1 - TREND_SMOOTHING) ** gap;
    out.push({ day: w.measuredOn, kg: w.kg, trendKg: Math.round((w.kg + (prev.trendKg - w.kg) * keep) * 1000) / 1000 });
  }
  return out;
}

/** The window the weekly rate looks back over. */
export const RATE_WINDOW_DAYS = 28;

/**
 * The weekly change over the last four weeks, in kg a week: the slope of a
 * straight line through those weigh-ins. Null with fewer than three
 * weigh-ins, or when they span less than a week, since a rate from two
 * mornings is mostly water.
 */
export function weeklyRate(weighIns: readonly WeighIn[], today: string, windowDays = RATE_WINDOW_DAYS): number | null {
  const end = dayNumber(today);
  const points = weighIns
    .filter((w) => validWeighInKg(w.kg))
    .map((w) => ({ x: dayNumber(w.measuredOn), y: w.kg }))
    .filter((p) => p.x <= end && p.x > end - windowDays);
  if (points.length < 3) return null;
  const xs = points.map((p) => p.x);
  if (Math.max(...xs) - Math.min(...xs) < 7) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / points.length;
  const my = points.reduce((a, p) => a + p.y, 0) / points.length;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den > 0 ? Math.round((num / den) * 7 * 1000) / 1000 : null;
}
