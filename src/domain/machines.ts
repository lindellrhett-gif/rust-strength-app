/**
 * Learning how machines compare, so strength on one carries over to another.
 *
 * Two cable stacks can label the same resistance differently: 50 on one may
 * feel like 100 on the other. For each pair of machines the app compares how
 * strong you were on each within a few weeks, for the same exercise, and takes
 * the typical ratio. Your sets on other machines are then scaled into the
 * units of the machine in front of you before the usual recommendation runs,
 * so a record of 60 on the first stack suggests about 120 on the second.
 *
 * Pure, no I/O.
 */

import { EPLEY_K, repsInReserve, type LoggedSet } from './recommender';

/** Sessions further apart than this say little about how two machines compare. */
export const PAIR_WINDOW_DAYS = 14;
/** Only the most recent comparisons count, so the ratio follows the gym. */
export const MAX_PAIRS = 12;
/** Ratios outside this band are treated as a logging mistake, not a machine. */
export const MIN_RATIO = 0.2;
export const MAX_RATIO = 5;
/** Reps above this are too noisy to compare strength by. */
const MAX_COMPARE_REPS = 20;

const DAY_MS = 86_400_000;

/** A working set on a machine, from any exercise. */
export interface MachineSet {
  exerciseId: string;
  workoutId: string;
  machineId: string;
  weight: number;
  reps: number;
  rpe: number | null;
  performedAt: string | number | Date;
}

export interface MachineRatio {
  /** Multiply a weight on the other machine by this to get the target's units. */
  ratio: number;
  /** How many session comparisons it rests on. */
  pairs: number;
}

interface Session {
  exerciseId: string;
  machineId: string;
  time: number;
  /** Best estimated one-rep max in the session, in that machine's units. */
  strength: number;
}

function toTime(v: string | number | Date): number {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Strength shown by one set, in the units of the machine it was on. */
function setStrength(s: { weight: number; reps: number; rpe: number | null }): number {
  if (s.weight <= 0 || s.reps <= 0) return 0;
  const reps = Math.min(s.reps + repsInReserve(s.rpe), MAX_COMPARE_REPS);
  return s.weight * (1 + EPLEY_K * reps);
}

/** One entry per exercise, workout and machine: the best set in it. */
function sessions(sets: MachineSet[]): Session[] {
  const byKey = new Map<string, Session>();
  for (const s of sets) {
    const strength = setStrength(s);
    if (strength <= 0) continue;
    const key = `${s.exerciseId}|${s.workoutId}|${s.machineId}`;
    const time = toTime(s.performedAt);
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, { exerciseId: s.exerciseId, machineId: s.machineId, time, strength });
    else {
      prev.strength = Math.max(prev.strength, strength);
      prev.time = Math.max(prev.time, time);
    }
  }
  return [...byKey.values()];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * How many of `to`'s units one unit on `from` is worth, learned from the
 * sessions of any exercise done on both within {@link PAIR_WINDOW_DAYS}.
 * Null until there is at least one such comparison.
 *
 * Each session on `from` is compared with the nearest session of the same
 * exercise on `to`. Pooling across exercises lets a ratio learned on cable
 * rows help cable curls; the median keeps one odd session from moving it.
 */
export function learnRatio(sets: MachineSet[], from: string, to: string): MachineRatio | null {
  if (from === to) return { ratio: 1, pairs: 0 };
  const all = sessions(sets);
  const onFrom = all.filter((s) => s.machineId === from);
  const onTo = all.filter((s) => s.machineId === to);

  const nearestOf = (s: Session, pool: Session[]): Session | null => {
    let best: Session | null = null;
    for (const p of pool) {
      if (p.exerciseId !== s.exerciseId) continue;
      if (Math.abs(p.time - s.time) > PAIR_WINDOW_DAYS * DAY_MS) continue;
      if (!best || Math.abs(p.time - s.time) < Math.abs(best.time - s.time)) best = p;
    }
    return best;
  };

  // Only sessions that are each other's nearest are compared. Strength moves
  // over time, so pairing today's record on one machine with an older session
  // on the other would read the progress as a difference between machines.
  const pairs: { time: number; ratio: number }[] = [];
  for (const a of onFrom) {
    const b = nearestOf(a, onTo);
    if (!b || nearestOf(b, onFrom) !== a) continue;
    const ratio = b.strength / a.strength;
    if (ratio >= MIN_RATIO && ratio <= MAX_RATIO) {
      pairs.push({ time: Math.max(a.time, b.time), ratio });
    }
  }

  if (pairs.length === 0) return null;
  const recent = pairs.sort((x, y) => y.time - x.time).slice(0, MAX_PAIRS);
  return { ratio: Math.round(median(recent.map((p) => p.ratio)) * 100) / 100, pairs: recent.length };
}

export interface Conversion {
  machineId: string;
  ratio: number;
  pairs: number;
}

export interface ConvertedHistory {
  /** History in the target machine's units, ready for the recommender. */
  history: LoggedSet[];
  /** Other machines whose sets were scaled in, and by how much. */
  conversions: Conversion[];
  /** Other machines with sets for this exercise but no learned ratio yet. */
  unmatched: string[];
  /**
   * True when none of the history is from this machine or convertible to it,
   * so older sets with no machine recorded were used as they are.
   */
  usedUnrecorded: boolean;
}

/**
 * The exercise's history expressed in `target`'s units.
 *
 * - Sets on the target machine are used as they are.
 * - Sets on another machine are scaled by the learned ratio, or left out
 *   until one is learned (a first session on a new machine is by feel).
 * - Sets with no machine recorded are used only when nothing else applies.
 *   Most are from before machines were picked, likely on the same one.
 */
export function historyForMachine(
  history: LoggedSet[],
  target: string | null,
  machineSets: MachineSet[],
): ConvertedHistory {
  const unrecorded = history.filter((s) => s.machineId == null);

  if (target == null) {
    const usable = unrecorded.length > 0 ? unrecorded : history;
    return { history: usable, conversions: [], unmatched: [], usedUnrecorded: false };
  }

  const out: LoggedSet[] = history.filter((s) => s.machineId === target);
  const conversions: Conversion[] = [];
  const unmatched: string[] = [];

  const others = [...new Set(history.map((s) => s.machineId).filter((m): m is string => m != null && m !== target))];
  for (const machineId of others) {
    const learned = learnRatio(machineSets, machineId, target);
    if (!learned) {
      unmatched.push(machineId);
      continue;
    }
    conversions.push({ machineId, ratio: learned.ratio, pairs: learned.pairs });
    for (const s of history) {
      if (s.machineId !== machineId) continue;
      out.push({ ...s, weight: Math.round(s.weight * learned.ratio * 10) / 10, machineId: target });
    }
  }

  if (out.length === 0 && unrecorded.length > 0) {
    return { history: unrecorded, conversions: [], unmatched, usedUnrecorded: true };
  }
  return { history: out, conversions, unmatched, usedUnrecorded: false };
}
