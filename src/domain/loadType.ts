/**
 * How an exercise is loaded, and how that turns what the user entered into
 * the weight they actually moved.
 *
 * Every set stores the load moved in `weight`, whatever the type, so volume,
 * records, e1RM and the friend feed need to know nothing about load types. The
 * number the user typed is kept alongside it (`assist_weight` / `added_weight`)
 * so the set can be shown the way it was logged.
 */

export const LOAD_TYPES = ['weighted', 'bodyweight', 'assisted'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

export const LOAD_TYPE_LABEL: Record<LoadType, string> = {
  weighted: 'Weights',
  bodyweight: 'Bodyweight',
  assisted: 'Assisted',
};

/** One line under the type picker when creating an exercise. */
export const LOAD_TYPE_HINT: Record<LoadType, string> = {
  weighted: 'Suggests the weight for your next set.',
  bodyweight: 'Suggests more reps. You can still add weight, like a vest or belt.',
  assisted: 'The weight you pick is assistance, taken off your bodyweight. Less assistance is progress.',
};

export function asLoadType(value: string | null | undefined): LoadType {
  return (LOAD_TYPES as readonly string[]).includes(value ?? '') ? (value as LoadType) : 'weighted';
}

/**
 * Load moved on an assisted set: bodyweight minus assistance. Never negative —
 * assistance at or above bodyweight means the machine is doing all the work.
 */
export function assistedLoad(bodyWeight: number, assist: number): number {
  if (!Number.isFinite(bodyWeight) || !Number.isFinite(assist)) return 0;
  return Math.max(0, round1(bodyWeight - Math.max(0, assist)));
}

/**
 * Load moved on a bodyweight set: bodyweight plus anything added. Without a
 * known bodyweight only the added weight counts, which undercounts volume but
 * never invents a number.
 */
export function bodyweightLoad(bodyWeight: number | null, added: number): number {
  const base = bodyWeight != null && Number.isFinite(bodyWeight) && bodyWeight > 0 ? bodyWeight : 0;
  const extra = Number.isFinite(added) && added > 0 ? added : 0;
  return round1(base + extra);
}

/** Why an assisted set cannot be saved, or null when it can. */
export function assistProblem(bodyWeight: number | null, assist: number): string | null {
  if (bodyWeight == null || bodyWeight <= 0) {
    return 'Assisted exercises need your bodyweight.';
  }
  if (assist >= bodyWeight) {
    return 'Assistance has to be less than your bodyweight.';
  }
  return null;
}

export interface SetLoadFields {
  weight: number;
  isBodyweight: boolean;
  assistWeight?: number | null;
  addedWeight?: number | null;
}

/** How a logged set's load reads in a list: "40 lb assist", "BW + 25 lb", "185". */
export function formatSetLoad(set: SetLoadFields, unit: string): string {
  if (set.assistWeight != null) {
    return set.assistWeight > 0 ? `${trimWeight(set.assistWeight)} ${unit} assist` : 'No assist';
  }
  if (set.addedWeight != null) {
    return set.addedWeight > 0 ? `BW + ${trimWeight(set.addedWeight)} ${unit}` : 'BW';
  }
  if (set.isBodyweight) return 'BW';
  return trimWeight(set.weight);
}

/** A picker sublabel: "back" or "back · Assisted". */
export function exerciseSublabel(muscleGroup: string, loadType: LoadType): string {
  return loadType === 'weighted' ? muscleGroup : `${muscleGroup} · ${LOAD_TYPE_LABEL[loadType]}`;
}

/** 152.5 -> "152.5", 150 -> "150". Local, so the domain layer imports nothing. */
function trimWeight(n: number): string {
  return Number(n.toFixed(1)).toString();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
