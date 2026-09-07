/**
 * Pure weight-rounding helpers. A "machine" (or barbell setup) has a smallest
 * usable weight step (`increment`) — e.g. 5 lb selectorized stack, 2.5 lb
 * dumbbells, 10 lb plate jumps. Recommendations must land on a real step.
 */

export type RoundingBias = 'nearest' | 'down' | 'up';

const EPS = 1e-9;

/**
 * Round `value` to the nearest multiple of `increment`.
 *
 * - `bias: 'down'` never rounds above `value` (good for a first working set).
 * - `bias: 'up'` never rounds below `value`.
 * - A non-positive or non-finite `increment` falls back to whole numbers.
 * - The result is never negative.
 */
export function roundToIncrement(
  value: number,
  increment: number,
  bias: RoundingBias = 'nearest',
): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(increment) || increment <= 0) {
    return Math.max(0, Math.round(value));
  }

  const quotient = value / increment;
  let steps: number;
  switch (bias) {
    case 'down':
      steps = Math.floor(quotient + EPS);
      break;
    case 'up':
      steps = Math.ceil(quotient - EPS);
      break;
    default:
      steps = Math.round(quotient);
  }

  const rounded = steps * increment;
  // Guard against floating-point dust like 47.00000000001.
  return Math.max(0, Number(rounded.toFixed(6)));
}

/** Clamp `value` into `[min, max]`. If the bounds are inverted, returns `value`. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) return value;
  return Math.min(max, Math.max(min, value));
}
