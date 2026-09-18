/**
 * Workout generator — pure, deterministic, no network.
 *
 * Builds a session from three things the app already knows:
 *   1. the equipment the user says they have right now,
 *   2. which muscle groups they have not trained this week,
 *   3. their own e1RM history, so suggested weights are real numbers.
 *
 * A seeded RNG keeps a given (seed, inputs) pair reproducible, so re-opening
 * the screen does not silently reshuffle the plan.
 */

import { estimateE1rm, repRangeOrDefault, type LoggedSet } from './recommender';
import { roundToIncrement } from './rounding';
import { MUSCLE_GROUPS, type MuscleGroup } from './stats';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'bands';

export const EQUIPMENT_OPTIONS: Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'bands',
];

export interface GeneratorExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  /** null = usable with anything (custom exercises default to this). */
  equipment: Equipment | null;
  /**
   * Only weighted exercises get a starting weight. For bodyweight moves the
   * target is reps, and for assisted ones a weight would be the load moved,
   * not the assistance to set, so neither is shown a number. Timed holds
   * are suggested in seconds on the set screen.
   */
  loadType?: 'weighted' | 'bodyweight' | 'assisted' | 'timed';
}

export type Focus = 'full-body' | 'upper' | 'lower' | 'push' | 'pull';

export const FOCUS_GROUPS: Record<Focus, MuscleGroup[]> = {
  'full-body': [...MUSCLE_GROUPS],
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps'],
};

export interface GenerateInput {
  exercises: GeneratorExercise[];
  availableEquipment: Equipment[];
  focus: Focus;
  /** How many exercises to include. */
  exerciseCount: number;
  setsPerExercise: number;
  targetRepLow: number;
  targetRepHigh: number;
  /** Set counts per muscle group so far this week — drives prioritisation. */
  weekCoverage: Partial<Record<MuscleGroup, number>>;
  /** Recent sets keyed by exercise id, used to suggest a starting weight. */
  historyByExercise: Record<string, LoggedSet[]>;
  /** Rounding step when no machine is known. */
  defaultIncrement?: number;
  seed?: number;
}

export interface GeneratedItem {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  sets: number;
  repLow: number;
  repHigh: number;
  /** null when the user has no history for this movement yet. */
  suggestedWeight: number | null;
  reason: string;
}

export interface GeneratedWorkout {
  items: GeneratedItem[];
  /** Empty when a plan could be built; otherwise explains why it could not. */
  warning: string | null;
}

// --- seeded RNG (mulberry32) -----------------------------------------------

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- helpers ---------------------------------------------------------------

function isUsable(ex: GeneratorExercise, available: Equipment[]): boolean {
  if (ex.equipment == null) return true; // unknown/custom: always eligible
  if (available.length === 0) return true; // user picked nothing: no filtering
  return available.includes(ex.equipment);
}

/** Groups in focus, least-trained first; ties broken by the seeded RNG. */
function prioritiseGroups(
  focus: Focus,
  coverage: Partial<Record<MuscleGroup, number>>,
  rng: () => number,
): MuscleGroup[] {
  return [...FOCUS_GROUPS[focus]]
    .map((g) => ({ g, sets: coverage[g] ?? 0, jitter: rng() }))
    .sort((a, b) => a.sets - b.sets || a.jitter - b.jitter)
    .map((x) => x.g);
}

function suggestWeight(
  history: LoggedSet[] | undefined,
  targetReps: number,
  increment: number,
): number | null {
  if (!history || history.length === 0) return null;
  const est = estimateE1rm(history);
  if (est.count === 0) return null;
  const raw = est.value / (1 + (1 / 30) * targetReps);
  const rounded = roundToIncrement(raw, increment, 'down');
  return rounded > 0 ? rounded : null;
}

// --- main ------------------------------------------------------------------

export function generateWorkout(input: GenerateInput): GeneratedWorkout {
  const [repLow, repHigh] = repRangeOrDefault(input.targetRepLow, input.targetRepHigh);
  const targetReps = Math.round((repLow + repHigh) / 2);
  const increment = input.defaultIncrement && input.defaultIncrement > 0 ? input.defaultIncrement : 5;
  const sets = Math.max(1, Math.round(input.setsPerExercise || 3));
  const want = Math.max(1, Math.round(input.exerciseCount || 5));
  const rng = makeRng(input.seed ?? 1);

  const usable = input.exercises.filter((e) => isUsable(e, input.availableEquipment));
  if (usable.length === 0) {
    return {
      items: [],
      warning:
        'No exercises match that equipment. Try selecting more equipment, or add a custom exercise.',
    };
  }

  const byGroup = new Map<MuscleGroup, GeneratorExercise[]>();
  for (const e of usable) {
    const list = byGroup.get(e.muscleGroup) ?? [];
    list.push(e);
    byGroup.set(e.muscleGroup, list);
  }

  const order = prioritiseGroups(input.focus, input.weekCoverage, rng);
  const picked: GeneratedItem[] = [];
  const usedIds = new Set<string>();

  // Round-robin the prioritised groups so the session stays balanced rather
  // than stacking every slot onto the single least-trained group.
  let guard = 0;
  while (picked.length < want && guard < want * order.length + order.length) {
    guard += 1;
    let addedThisPass = false;

    for (const group of order) {
      if (picked.length >= want) break;
      const candidates = (byGroup.get(group) ?? []).filter((e) => !usedIds.has(e.id));
      if (candidates.length === 0) continue;

      const choice = candidates[Math.floor(rng() * candidates.length)] ?? candidates[0];
      usedIds.add(choice.id);
      addedThisPass = true;

      const trainedThisWeek = input.weekCoverage[group] ?? 0;
      const weighted = (choice.loadType ?? 'weighted') === 'weighted';
      const weight = weighted
        ? suggestWeight(input.historyByExercise[choice.id], targetReps, increment)
        : null;

      const reasons: string[] = [];
      reasons.push(
        trainedThisWeek === 0
          ? `${group} not trained yet this week`
          : `${group} · ${trainedThisWeek} set${trainedThisWeek === 1 ? '' : 's'} so far this week`,
      );
      reasons.push(
        choice.loadType === 'bodyweight'
          ? 'bodyweight — aim for more reps than last time'
          : choice.loadType === 'assisted'
            ? 'assisted — the set screen suggests your assistance'
            : choice.loadType === 'timed'
              ? 'timed — aim to hold longer than last time'
              : weight == null
                ? 'no history yet — pick a weight by feel'
                : 'weight from your e1RM',
      );

      picked.push({
        exerciseId: choice.id,
        exerciseName: choice.name,
        muscleGroup: group,
        sets,
        repLow,
        repHigh,
        suggestedWeight: weight,
        reason: reasons.join(' · '),
      });
    }

    if (!addedThisPass) break; // every group exhausted
  }

  return {
    items: picked,
    warning:
      picked.length < want
        ? `Only ${picked.length} exercise${picked.length === 1 ? '' : 's'} available for that equipment and focus.`
        : null,
  };
}
