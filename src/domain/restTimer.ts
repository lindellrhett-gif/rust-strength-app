/**
 * Rest timer maths.
 *
 * The timer is driven by a wall-clock deadline rather than a counter that ticks
 * down, for the same reason the workout timer is: phones throttle intervals
 * when the screen sleeps, and a decrementing counter silently loses time. A
 * deadline is either passed or it is not.
 */

export const MIN_REST_SECONDS = 5;
export const MAX_REST_SECONDS = 60 * 60;
export const DEFAULT_REST_SECONDS = 120;

/** The one-tap durations offered under the timer. */
export const REST_PRESETS = [30, 60, 90, 120, 180, 300] as const;

/** How much the +/- buttons move the clock, mid-rest or at rest. */
export const REST_STEP_SECONDS = 15;

export function clampRest(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_REST_SECONDS;
  return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, Math.round(seconds)));
}

/** Nudge a duration by a step, snapped back inside the allowed range. */
export function adjustRest(seconds: number, delta: number): number {
  return clampRest(seconds + delta);
}

/**
 * Seconds left on a deadline. Never negative: an overdue timer reads 0, and
 * `isRestOver` is what decides whether it fired.
 */
export function remainingSeconds(endsAtMs: number, nowMs: number): number {
  if (!Number.isFinite(endsAtMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

export function isRestOver(endsAtMs: number, nowMs: number): boolean {
  return nowMs >= endsAtMs;
}

/** 0..1 elapsed across the rest, for the progress ring. */
export function restProgress(totalSeconds: number, remaining: number): number {
  if (totalSeconds <= 0) return 1;
  const done = (totalSeconds - remaining) / totalSeconds;
  return Math.min(1, Math.max(0, done));
}

/** `m:ss`, counting up past an hour rather than wrapping. */
export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** A short human label for a preset button: "90s", "2 min", "5 min". */
export function restLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s % 60 === 0) return `${s / 60} min`;
  return formatRest(s);
}
