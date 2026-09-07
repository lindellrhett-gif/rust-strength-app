/**
 * Workout presets — pure logic, no I/O.
 *
 * A session can now carry *planned slots* (from a preset or the generator) that
 * exist before any set is logged. This module merges those slots with whatever
 * has actually been performed, so the workout screen can show:
 *
 *   Bench Press        0/4 sets      <- planned, nothing done yet
 *   Incline DB Press   2/3 sets      <- in progress
 *   Lateral Raise      3/3 sets  ✓   <- done
 *   Cable Curl         2 sets        <- not planned, added on the fly
 *
 * Planned slots keep their plan order. Anything performed outside the plan is
 * appended in the order it was first logged, so the session still reads
 * chronologically at the bottom.
 */

import { groupSetsByExercise, type GroupableSet } from './grouping';

export interface PlannedSlot {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  /** What the generator suggested; shown until a real set replaces it. */
  suggestedWeight: number | null;
}

export interface WorkoutBlock {
  key: string;
  exerciseId: string;
  exerciseName: string;
  sets: GroupableSet[];
  /** Null when this exercise was not part of the plan. */
  targetSets: number | null;
  targetRepLow: number | null;
  targetRepHigh: number | null;
  suggestedWeight: number | null;
  /** True when the block came from a preset / generated plan. */
  planned: boolean;
  /** Working sets performed so far. */
  workingSets: number;
  /** Planned and every target set logged. */
  complete: boolean;
  volume: number;
  bestE1rm: number | null;
}

function summarise(sets: GroupableSet[]) {
  let volume = 0;
  let working = 0;
  let best: number | null = null;
  for (const s of sets) {
    if (s.isWarmup) continue;
    working += 1;
    volume += s.weight * s.reps;
    if (best == null || s.e1rm > best) best = s.e1rm;
  }
  return { volume: Math.round(volume), working, best };
}

/**
 * Merge a session's planned slots with its logged sets.
 *
 * Sets are matched to a slot by exercise. Coming back to a planned movement
 * later in the session adds to that slot rather than creating a second block —
 * the plan is the organising principle once one exists.
 */
export function buildWorkoutBlocks(
  slots: PlannedSlot[],
  sets: GroupableSet[],
): WorkoutBlock[] {
  const byExercise = new Map<string, GroupableSet[]>();
  for (const s of [...sets].sort((a, b) => a.orderIndex - b.orderIndex)) {
    const list = byExercise.get(s.exerciseId);
    if (list) list.push(s);
    else byExercise.set(s.exerciseId, [s]);
  }

  const blocks: WorkoutBlock[] = [];
  const plannedIds = new Set<string>();

  for (const slot of [...slots].sort((a, b) => a.orderIndex - b.orderIndex)) {
    plannedIds.add(slot.exerciseId);
    const slotSets = byExercise.get(slot.exerciseId) ?? [];
    const { volume, working, best } = summarise(slotSets);
    blocks.push({
      key: `slot-${slot.id}`,
      exerciseId: slot.exerciseId,
      exerciseName: slot.exerciseName,
      sets: slotSets,
      targetSets: slot.targetSets,
      targetRepLow: slot.targetRepLow,
      targetRepHigh: slot.targetRepHigh,
      suggestedWeight: slot.suggestedWeight,
      planned: true,
      workingSets: working,
      complete: working >= slot.targetSets,
      volume,
      bestE1rm: best,
    });
  }

  // Anything logged that was not in the plan, in the order it first appeared.
  const unplanned = sets.filter((s) => !plannedIds.has(s.exerciseId));
  for (const g of groupSetsByExercise(unplanned)) {
    blocks.push({
      key: `adhoc-${g.key}`,
      exerciseId: g.exerciseId,
      exerciseName: g.exerciseName,
      sets: g.sets,
      targetSets: null,
      targetRepLow: null,
      targetRepHigh: null,
      suggestedWeight: null,
      planned: false,
      workingSets: g.workingSets,
      complete: false,
      volume: g.volume,
      bestE1rm: g.bestE1rm,
    });
  }

  return blocks;
}

/** "3 of 4 sets" style progress for a session with a plan. */
export function planProgress(blocks: WorkoutBlock[]): {
  done: number;
  target: number;
  complete: boolean;
} {
  let done = 0;
  let target = 0;
  for (const b of blocks) {
    if (!b.planned || b.targetSets == null) continue;
    target += b.targetSets;
    done += Math.min(b.workingSets, b.targetSets);
  }
  return { done, target, complete: target > 0 && done >= target };
}

/** The next planned movement that still owes sets — drives "Up next". */
export function nextUpBlock(blocks: WorkoutBlock[]): WorkoutBlock | null {
  return blocks.find((b) => b.planned && !b.complete) ?? null;
}

// --- Building a preset from a finished session ------------------------------

export interface TemplateDraftItem {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
}

/**
 * Turn a performed session into preset contents: each distinct exercise once,
 * in the order first performed, with the number of working sets actually done.
 * Warmups do not count toward the target but do not drop the exercise either.
 */
export function templateDraftFromSets(sets: GroupableSet[]): TemplateDraftItem[] {
  const order: string[] = [];
  const seen = new Map<
    string,
    { name: string; working: number; low: number; high: number }
  >();

  for (const s of [...sets].sort((a, b) => a.orderIndex - b.orderIndex)) {
    let entry = seen.get(s.exerciseId);
    if (!entry) {
      entry = { name: s.exerciseName, working: 0, low: 6, high: 8 };
      seen.set(s.exerciseId, entry);
      order.push(s.exerciseId);
    }
    if (!s.isWarmup) entry.working += 1;
  }

  return order.map((id) => {
    const e = seen.get(id)!;
    return {
      exerciseId: id,
      exerciseName: e.name,
      targetSets: Math.max(1, e.working),
      targetRepLow: e.low,
      targetRepHigh: e.high,
    };
  });
}

/** Trim and validate a preset name. Returns null when unusable. */
export function normalizeTemplateName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0 || name.length > 60) return null;
  return name;
}
