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
/** Most reps a set or a target can have. High enough for push-up and sit-up sets. */
export const MAX_REPS = 200;

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
  /** Bodyweight exercises only: weight added on top of bodyweight. */
  addedWeight?: number | null;
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
  if (lo < 1 || hi < 1 || lo > hi || hi > MAX_REPS) return [...DEFAULT_REP_RANGE];
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

interface Target {
  /** Load to aim for, before rounding to a real step. */
  load: number;
  estimate: E1rmEstimate;
  last: LoggedSet;
  correction: number;
}

/** The unrounded load for the next set, or null with no working history. */
function targetLoad(input: RecommendInput, repRange: [number, number]): Target | null {
  const estimate = estimateE1rm(input.history);
  if (estimate.count === 0) return null;

  const last = estimate.sortedWorkingSets[estimate.sortedWorkingSets.length - 1];
  const targetReps = Math.round((repRange[0] + repRange[1]) / 2);

  // Invert Epley for the target reps at RPE 10 (no reps in reserve), capped
  // exactly as the estimate was. Otherwise a 10–15 range would be priced with
  // more reps than any set was ever credited with, and come out too light.
  const baseWeight = estimate.value / (1 + EPLEY_K * Math.min(targetReps, MAX_EFFECTIVE_REPS));

  const correction = rpeCorrection(last, repRange[0]);
  // Never jump more than MAX_STEP_CHANGE from the last set.
  const load = clamp(
    baseWeight * (1 + correction),
    last.weight * (1 - MAX_STEP_CHANGE),
    last.weight * (1 + MAX_STEP_CHANGE),
  );

  return { load, estimate, last, correction };
}

function rationaleFor(target: Target, input: RecommendInput): string[] {
  const { estimate, last, correction } = target;
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
  return parts;
}

export function recommendNextWeight(input: RecommendInput): Recommendation {
  const repRange = repRangeOrDefault(input.targetRepLow, input.targetRepHigh);
  const target = targetLoad(input, repRange);

  if (!target) {
    return {
      suggestedWeight: null,
      repRange,
      e1rm: null,
      confidence: 'low',
      rationale: 'Log your first working set to get a recommendation.',
    };
  }

  const bias: RoundingBias = input.isFirstWorkingSet ? 'down' : 'nearest';
  let suggestedWeight = roundToIncrement(target.load, input.increment, bias);
  if (suggestedWeight <= 0) {
    suggestedWeight = input.increment > 0 ? input.increment : 1;
  }

  return {
    suggestedWeight,
    repRange,
    e1rm: Math.round(target.estimate.value * 10) / 10,
    confidence: confidenceFor(target.estimate.count),
    rationale: rationaleFor(target, input).join(' · '),
  };
}

// --- Assisted exercises ------------------------------------------------------

export interface AssistedInput extends RecommendInput {
  /**
   * The user's bodyweight now. History carries the load actually moved
   * (bodyweight minus assistance at the time), so it stays right as their
   * bodyweight changes.
   */
  bodyWeight: number;
}

export interface AssistedRecommendation extends Recommendation {
  /** Assistance to set on the machine. 0 means try it with none. */
  suggestedAssist: number | null;
}

/**
 * Assisted pull-ups, dips and the like. The maths runs on the load actually
 * moved, exactly as for a weighted lift, then converts back to assistance:
 * assistance = bodyweight - target load. Getting stronger means less of it.
 */
export function recommendAssisted(input: AssistedInput): AssistedRecommendation {
  const repRange = repRangeOrDefault(input.targetRepLow, input.targetRepHigh);
  const target = targetLoad(input, repRange);

  if (!target || !(input.bodyWeight > 0)) {
    return {
      suggestedWeight: null,
      suggestedAssist: null,
      repRange,
      e1rm: null,
      confidence: 'low',
      rationale: target
        ? 'Add your bodyweight in Profile to get assistance suggestions.'
        : 'Log your first working set to get a recommendation.',
    };
  }

  // Rounding favours more assistance on the first working set — the easier
  // side, as 'down' is for a weighted lift.
  const bias: RoundingBias = input.isFirstWorkingSet ? 'up' : 'nearest';
  const assist = clamp(
    roundToIncrement(input.bodyWeight - target.load, input.increment, bias),
    0,
    input.bodyWeight,
  );

  const parts = rationaleFor(target, input);
  if (assist === 0) parts.push('you may be ready to try it with no assistance');

  return {
    suggestedAssist: assist,
    suggestedWeight: Math.max(0, Math.round((input.bodyWeight - assist) * 10) / 10),
    repRange,
    e1rm: Math.round(target.estimate.value * 10) / 10,
    confidence: confidenceFor(target.estimate.count),
    rationale: parts.join(' · '),
  };
}

// --- Bodyweight exercises: progress by reps ------------------------------------

/** The most a single suggestion may add over the last set's reps. */
export const MAX_REP_JUMP = 5;

export interface RepSet {
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  /** Weight added on top of bodyweight; null or 0 for plain bodyweight. */
  addedWeight: number | null;
  performedAt: string | number | Date;
}

export interface RepsInput {
  history: RepSet[];
  /** The added weight about to be used. Only sets at the same added weight count. */
  addedWeight: number;
}

export interface RepsRecommendation {
  suggestedReps: number | null;
  /** Smoothed reps the user could do to failure at this added weight. */
  estimatedMaxReps: number | null;
  confidence: Confidence;
  rationale: string;
}

function sameAdded(a: number | null, b: number): boolean {
  return Math.abs((a ?? 0) - b) < 0.01;
}

/**
 * Push-ups, pull-ups, dips: the load is the body, so progress is reps.
 *
 * Each set says how many reps were possible — the reps done plus the reps left
 * in reserve its RPE implies. Those are smoothed newest-heaviest, the same way
 * the weight recommender smooths e1RM, and the suggestion is that many: a set
 * taken to failure. Someone who had reps left last time is therefore asked for
 * more; someone who ground out their last rep is asked to match it.
 */
export function recommendReps(input: RepsInput): RepsRecommendation {
  const working = input.history
    .filter((s) => !s.isWarmup && s.reps > 0 && sameAdded(s.addedWeight, input.addedWeight))
    .sort((a, b) => toTime(a.performedAt) - toTime(b.performedAt));
  const recent = working.slice(-RECENT_SET_WINDOW);

  if (recent.length === 0) {
    return {
      suggestedReps: null,
      estimatedMaxReps: null,
      confidence: 'low',
      rationale:
        working.length === 0 && input.history.some((s) => !s.isWarmup && s.reps > 0)
          ? 'No sets at this added weight yet. Log one to get a rep target.'
          : 'Log your first working set to get a rep target.',
    };
  }

  const capacity = (s: RepSet) => s.reps + repsInReserve(s.rpe);
  let ema = capacity(recent[0]);
  for (let i = 1; i < recent.length; i += 1) {
    ema = EMA_ALPHA * capacity(recent[i]) + (1 - EMA_ALPHA) * ema;
  }

  const last = recent[recent.length - 1];
  const suggestedReps = clamp(Math.round(ema), 1, last.reps + MAX_REP_JUMP);

  const parts = [`Based on ${recent.length} recent set${recent.length === 1 ? '' : 's'}`];
  if (last.rpe != null && last.rpe < 8) parts.push('last set felt easy — go for more');
  else if (last.rpe != null && last.rpe >= 9.5) parts.push('last set was close to failure');

  return {
    suggestedReps,
    estimatedMaxReps: Math.round(ema * 10) / 10,
    confidence: confidenceFor(recent.length),
    rationale: parts.join(' · '),
  };
}

// --- Timed exercises: progress by time -----------------------------------------

/** Holds are suggested in steps this size, in seconds. */
export const HOLD_STEP_SECONDS = 5;
/** A suggestion may add at most this fraction of the last hold... */
export const MAX_HOLD_JUMP_FRACTION = 0.2;
/** ...or this many seconds, whichever is more, so short holds can still grow. */
export const MIN_HOLD_JUMP_SECONDS = 10;
/** Each rep in reserve on a hold's RPE is read as this much more time. */
export const HOLD_RESERVE_FRACTION = 0.1;

export interface HoldSet {
  seconds: number;
  rpe: number | null;
  isWarmup: boolean;
  /** Weight held on top, like a plate on the back. null or 0 for none. */
  addedWeight: number | null;
  performedAt: string | number | Date;
}

export interface DurationInput {
  history: HoldSet[];
  /** Only holds at the same added weight count toward the target. */
  addedWeight: number;
}

export interface DurationRecommendation {
  suggestedSeconds: number | null;
  /** Smoothed longest hold the user could manage, in seconds. */
  estimatedMaxSeconds: number | null;
  confidence: Confidence;
  rationale: string;
}

/**
 * Planks, wall sits, dead hangs: progress is time.
 *
 * The same idea as reps for bodyweight work. Each hold says how long was
 * possible: the time held, stretched by the reserve its RPE implies (RPE 8 on
 * a 60-second plank reads as about 72 seconds possible). Those are smoothed
 * newest-heaviest and the suggestion is that long, rounded to 5 seconds, and
 * never more than a modest step past the last hold.
 */
export function recommendDuration(input: DurationInput): DurationRecommendation {
  const working = input.history
    .filter((s) => !s.isWarmup && s.seconds > 0 && sameAdded(s.addedWeight, input.addedWeight))
    .sort((a, b) => toTime(a.performedAt) - toTime(b.performedAt));
  const recent = working.slice(-RECENT_SET_WINDOW);

  if (recent.length === 0) {
    return {
      suggestedSeconds: null,
      estimatedMaxSeconds: null,
      confidence: 'low',
      rationale:
        input.history.some((s) => !s.isWarmup && s.seconds > 0)
          ? 'No holds at this added weight yet. Log one to get a time target.'
          : 'Log your first hold to get a time target.',
    };
  }

  const capacity = (s: HoldSet) => s.seconds * (1 + HOLD_RESERVE_FRACTION * repsInReserve(s.rpe));
  let ema = capacity(recent[0]);
  for (let i = 1; i < recent.length; i += 1) {
    ema = EMA_ALPHA * capacity(recent[i]) + (1 - EMA_ALPHA) * ema;
  }

  const last = recent[recent.length - 1];
  const ceiling = last.seconds + Math.max(MIN_HOLD_JUMP_SECONDS, last.seconds * MAX_HOLD_JUMP_FRACTION);
  const step = (s: number) => Math.round(s / HOLD_STEP_SECONDS) * HOLD_STEP_SECONDS;
  // The ceiling rounds down to a step too, so the suggestion is always one.
  const topStep = Math.max(
    HOLD_STEP_SECONDS,
    Math.floor(ceiling / HOLD_STEP_SECONDS) * HOLD_STEP_SECONDS,
  );
  const suggestedSeconds = clamp(step(ema), HOLD_STEP_SECONDS, topStep);

  const parts = [`Based on ${recent.length} recent hold${recent.length === 1 ? '' : 's'}`];
  if (last.rpe != null && last.rpe < 8) parts.push('last hold felt easy — go longer');
  else if (last.rpe != null && last.rpe >= 9.5) parts.push('last hold was close to your limit');

  return {
    suggestedSeconds,
    estimatedMaxSeconds: Math.round(ema),
    confidence: confidenceFor(recent.length),
    rationale: parts.join(' · '),
  };
}
