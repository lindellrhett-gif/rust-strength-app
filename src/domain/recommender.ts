/**
 * Autoregulated weight recommendation — pure, deterministic, no I/O.
 *
 * Two jobs:
 *   1. Estimate a one-rep max (e1RM) from a set logged with reps + RPE.
 *   2. Given recent history for an exercise, suggest the next set's weight so the
 *      user reaches failure inside their chosen rep range (default 6–8).
 *
 * The model is intentionally simple and explainable. A personalized ML layer
 * (per-machine strength offsets learned from `sets`) comes later; every input it
 * will need (machineId, rpe, e1rm per set) is already captured here.
 */

import { clamp, roundToIncrement, type RoundingBias } from './rounding';

// --- Tunable constants -------------------------------------------------------

/** Epley coefficient: 1RM ≈ weight * (1 + K * reps). */
export const EPLEY_K = 1 / 30; // 0.03333…
/** Exponential moving-average weight for the most recent set's e1RM. */
export const EMA_ALPHA = 0.3;
/** Above this, "reps to failure" estimates get too noisy to trust. */
export const MAX_EFFECTIVE_REPS = 12;
/** A suggestion may not move more than this fraction from the last set's weight. */
export const MAX_STEP_CHANGE = 0.15;
/** Largest proportional nudge from a single set's RPE feedback. */
export const RPE_CORRECTION_MAX = 0.07;
/** How many recent sets feed the e1RM estimate. */
export const RECENT_SET_WINDOW = 6;

export const DEFAULT_REP_RANGE: readonly [number, number] = [6, 8];

// --- Types -----------------------------------------------------------------

export interface LoggedSet {
  weight: number;
  reps: number;
  /** 5.0–10.0, or null if the user skipped it. */
  rpe: number | null;
  isWarmup: boolean;
  machineId: string | null;
  /** Anything Date-parseable; used only for recency ordering. */
  performedAt: string | number | Date;
}

export interface RecommendInput {
  /** Prior sets for THIS exercise (any order). Warmups are ignored. */
  history: LoggedSet[];
  targetRepLow: number;
  targetRepHigh: number;
  /** Smallest weight step on the machine the user is about to use. */
  increment: number;
  currentMachineId: string | null;
  /** First working set of the session for this exercise → round down, not nearest. */
  isFirstWorkingSet?: boolean;
}

export type Confidence = 'low' | 'medium' | 'high';

export interface Recommendation {
  /** null when there is no history to work from. */
  suggestedWeight: number | null;
  repRange: [number, number];
  /** Smoothed working e1RM, rounded to 0.1. null when there is no history. */
  e1rm: number | null;
  confidence: Confidence;
  /** Short human-readable explanation for the UI. */
  rationale: string;
}

// --- e1RM ------------------------------------------------------------------

/** Raw Epley estimate. `reps` is clamped to {@link MAX_EFFECTIVE_REPS}. */
export function epleyE1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight; // avoid Epley's ~3% overshoot at a true single
  const effective = Math.min(reps, MAX_EFFECTIVE_REPS);
  return weight * (1 + EPLEY_K * effective);
}

/** Reps in reserve implied by an RPE (RPE 8 → 2 in the tank). */
export function repsInReserve(rpe: number | null): number {
  if (rpe == null) return 0; // assume the set was taken to failure
  return clamp(10 - rpe, 0, 5);
}

/** e1RM from a single logged set, accounting for RPE (reps left in reserve). */
export function e1rmFromSet(set: Pick<LoggedSet, 'weight' | 'reps' | 'rpe'>): number {
  const effectiveReps = set.reps + repsInReserve(set.rpe);
  return epleyE1rm(set.weight, effectiveReps);
}

interface E1rmEstimate {
  value: number;
  /** Number of working sets that contributed. */
  count: number;
  sortedWorkingSets: LoggedSet[];
}

function toTime(v: string | number | Date): number {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Smoothed working e1RM across the most recent working sets for an exercise.
 * Oldest-to-newest EMA so the latest set carries the most weight.
 */
export function estimateE1rm(history: LoggedSet[]): E1rmEstimate {
  const working = history
    .filter((s) => !s.isWarmup && s.weight > 0 && s.reps > 0)
    .sort((a, b) => toTime(a.performedAt) - toTime(b.performedAt));

  const recent = working.slice(-RECENT_SET_WINDOW);
  if (recent.length === 0) {
    return { value: 0, count: 0, sortedWorkingSets: working };
  }

  let ema = e1rmFromSet(recent[0]);
  for (let i = 1; i < recent.length; i += 1) {
    ema = EMA_ALPHA * e1rmFromSet(recent[i]) + (1 - EMA_ALPHA) * ema;
  }

  return { value: ema, count: recent.length, sortedWorkingSets: working };
}

// --- Rep range -----------------------------------------------------------

/** Validate a user rep range, falling back to the default when nonsensical. */
export function repRangeOrDefault(low: number, high: number): [number, number] {
  const lo = Math.round(low);
  const hi = Math.round(high);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [...DEFAULT_REP_RANGE];
  if (lo < 1 || hi < 1 || lo > hi || hi > 30) return [...DEFAULT_REP_RANGE];
  return [lo, hi];
}

// --- Next-set recommendation -------------------------------------------------

function confidenceFor(count: number): Confidence {
  if (count >= 4) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

/**
 * RPE feedback correction based on the most recent working set.
 * Positive → go heavier; negative → go lighter.
 */
function rpeCorrection(last: LoggedSet, repLow: number): number {
  if (last.rpe == null) return 0;
  if (last.rpe >= 9.5 && last.reps < repLow) {
    return -RPE_CORRECTION_MAX; // maxed out and still missed the bottom of the range
  }
  if (last.rpe < 8) {
    return Math.min(RPE_CORRECTION_MAX, (8 - last.rpe) * 0.02); // had plenty left
  }
  return 0;
}

export function recommendNextWeight(input: RecommendInput): Recommendation {
  const repRange = repRangeOrDefault(input.targetRepLow, input.targetRepHigh);
  const estimate = estimateE1rm(input.history);

  if (estimate.count === 0) {
    return {
      suggestedWeight: null,
      repRange,
      e1rm: null,
      confidence: 'low',
      rationale: 'Log your first working set to get a recommendation.',
    };
  }

  const last = estimate.sortedWorkingSets[estimate.sortedWorkingSets.length - 1];
  const targetReps = Math.round((repRange[0] + repRange[1]) / 2);

  // Invert Epley for the target reps at RPE 10 (no reps in reserve).
  const baseWeight = estimate.value / (1 + EPLEY_K * targetReps);

  const correction = rpeCorrection(last, repRange[0]);
  let adjusted = baseWeight * (1 + correction);

  // Never jump more than MAX_STEP_CHANGE from the last set.
  adjusted = clamp(
    adjusted,
    last.weight * (1 - MAX_STEP_CHANGE),
    last.weight * (1 + MAX_STEP_CHANGE),
  );

  const bias: RoundingBias = input.isFirstWorkingSet ? 'down' : 'nearest';
  let suggestedWeight = roundToIncrement(adjusted, input.increment, bias);
  if (suggestedWeight <= 0) {
    suggestedWeight = input.increment > 0 ? input.increment : 1;
  }

  const parts: string[] = [
    `Based on ${estimate.count} recent set${estimate.count === 1 ? '' : 's'}`,
  ];
  if (correction > 0) parts.push('last set felt easier than target');
  else if (correction < 0) parts.push('last set was harder than target');
  if (
    input.currentMachineId &&
    last.machineId &&
    input.currentMachineId !== last.machineId
  ) {
    parts.push('different machine than last time — adjust by feel');
  }

  return {
    suggestedWeight,
    repRange,
    e1rm: Math.round(estimate.value * 10) / 10,
    confidence: confidenceFor(estimate.count),
    rationale: parts.join(' · '),
  };
}
