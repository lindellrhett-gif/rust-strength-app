/**
 * Reading a number typed straight into a row, as Profile does for bodyweight,
 * the rep range and the step goal. Kept apart from the screen so the awkward
 * cases can be tested: decimal commas, thousands commas, and a range whose two
 * ends meet.
 */

export interface InlineNumberRules {
  min: number;
  max: number;
  /** Decimal places to keep. */
  precision?: number;
}

/**
 * What was typed, inside its limits, or null when it isn't a number.
 *
 * A comma before exactly three digits groups thousands ("10,000"). Any other
 * comma is a decimal point, since phones in much of Europe and Quebec type
 * "82,5" for 82.5.
 */
export function parseInlineNumber(typed: string, rules: InlineNumberRules): number | null {
  const clean = typed
    .trim()
    .replace(/,(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  if (clean === '') return null;
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(rules.max, Math.max(rules.min, n));
  return Number(clamped.toFixed(rules.precision ?? 0));
}

/**
 * The rep range after one end is edited. The other end moves with it when they
 * would cross, so typing 12 as the low end of 6 to 8 gives 12 to 12 rather than
 * a range the weight suggestion would throw away.
 */
export function editRepRange(
  current: readonly [number, number],
  end: 'low' | 'high',
  value: number,
): [number, number] {
  return end === 'low'
    ? [value, Math.max(current[1], value)]
    : [Math.min(current[0], value), value];
}
