/**
 * Spoken updates during a run: what to say each time another mile or
 * kilometre goes by. Pure, no I/O; src/lib/runCues.ts does the speaking.
 */

import type { Split } from './splits';
import { METERS_PER, type RunDistanceUnit } from './units';

/** A length of time the way it is said out loud: "8 minutes 5 seconds". */
export function spokenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const part = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const parts: string[] = [];
  if (hours > 0) parts.push(part(hours, 'hour'));
  if (minutes > 0) parts.push(part(minutes, 'minute'));
  if (seconds > 0 || parts.length === 0) parts.push(part(seconds, 'second'));
  return parts.join(' ');
}

export interface Cue {
  /** How many whole miles or kilometres this announces. */
  split: number;
  text: string;
}

/**
 * The announcement due now, or null. `announced` is how many whole units
 * have been announced already, so each one is said once, and only the
 * latest if several went by at once (after a signal gap, say).
 */
export function cueFor(
  distanceM: number,
  movingSeconds: number,
  splits: readonly Split[],
  unit: RunDistanceUnit,
  announced: number,
): Cue | null {
  const whole = Math.floor(distanceM / METERS_PER[unit]);
  if (whole <= announced || whole < 1) return null;

  const name = unit === 'mi' ? 'mile' : 'kilometre';
  const lastFull = [...splits].reverse().find((s) => !s.partial);
  const averagePace = movingSeconds / (distanceM / METERS_PER[unit]);
  const sentences = [
    `${whole} ${name}${whole === 1 ? '' : 's'}.`,
    `Time, ${spokenDuration(movingSeconds)}.`,
    ...(lastFull && whole > 1 ? [`Last ${name}, ${spokenDuration(lastFull.seconds)}.`] : []),
    `Average pace, ${spokenDuration(averagePace)} per ${name}.`,
  ];
  return { split: whole, text: sentences.join(' ') };
}
