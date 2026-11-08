/**
 * A friend's numbers are stored in the unit they log in, which may not be yours.
 * Pure, so the two rules for reading them can be tested.
 *
 * A weight on screen is converted to the viewer's unit. Their trophies and level
 * are scored from their own numbers in their own unit, which is what their phone
 * does: `evaluateAchievements` and `computeXp` take a unit and work in pounds
 * themselves. Converting first would only add a trip through the other unit, and
 * rounding on that trip can leave a lift a hair under the line it exactly meets.
 */

import { convertVolume } from './leaderboard';

type Unit = 'lb' | 'kg';

/**
 * The unit a friend's stored numbers are in. Unknown until migration 0036 is
 * applied, or on an answer saved from before it; those read as the viewer's unit,
 * which leaves the numbers unconverted, as they were.
 */
export function friendDataUnit(friendUnit: Unit | null | undefined, viewerUnit: Unit): Unit {
  return friendUnit ?? viewerUnit;
}

/** A friend's total volume, in the viewer's unit. */
export function friendVolume(
  volume: number,
  friendUnit: Unit | null | undefined,
  viewerUnit: Unit,
): number {
  return convertVolume(volume, friendDataUnit(friendUnit, viewerUnit), viewerUnit);
}
