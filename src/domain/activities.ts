/**
 * Non-lifting activities — running, stair master, five-a-side, whatever.
 * Pure helpers only: labels, validation and aggregation. The timer itself
 * lives in the UI; this module just deals in seconds.
 */

export const ACTIVITY_KINDS = [
  'run',
  'walk',
  'hike',
  'cycle',
  'swim',
  'row',
  'stairmaster',
  'elliptical',
  'jump_rope',
  'basketball',
  'soccer',
  'tennis',
  'boxing',
  'climbing',
  'yoga',
  'other',
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  run: 'Run',
  walk: 'Walk',
  hike: 'Hike',
  cycle: 'Cycling',
  swim: 'Swim',
  row: 'Rowing',
  stairmaster: 'Stair Master',
  elliptical: 'Elliptical',
  jump_rope: 'Jump Rope',
  basketball: 'Basketball',
  soccer: 'Soccer',
  tennis: 'Tennis',
  boxing: 'Boxing',
  climbing: 'Climbing',
  yoga: 'Yoga',
  other: 'Other',
};

/**
 * Which optional metrics are worth offering for each kind. Everything stays
 * optional — this only decides what the form shows by default, so a basketball
 * game does not ask for distance.
 */
export const ACTIVITY_FIELDS: Record<
  ActivityKind,
  { distance: boolean; steps: boolean; calories: boolean }
> = {
  run: { distance: true, steps: true, calories: true },
  walk: { distance: true, steps: true, calories: true },
  hike: { distance: true, steps: true, calories: true },
  cycle: { distance: true, steps: false, calories: true },
  swim: { distance: true, steps: false, calories: true },
  row: { distance: true, steps: false, calories: true },
  stairmaster: { distance: false, steps: true, calories: true },
  elliptical: { distance: true, steps: false, calories: true },
  jump_rope: { distance: false, steps: false, calories: true },
  basketball: { distance: false, steps: false, calories: true },
  soccer: { distance: true, steps: false, calories: true },
  tennis: { distance: false, steps: false, calories: true },
  boxing: { distance: false, steps: false, calories: true },
  climbing: { distance: false, steps: false, calories: true },
  yoga: { distance: false, steps: false, calories: true },
  other: { distance: true, steps: true, calories: true },
};

export const DISTANCE_UNITS = ['mi', 'km', 'm'] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

export interface ActivityRecord {
  id: string;
  kind: ActivityKind;
  name: string | null;
  performedAt: string;
  durationSeconds: number;
  distance: number | null;
  distanceUnit: DistanceUnit | null;
  steps: number | null;
  calories: number | null;
}

/** What to call an activity in a list: its custom name, else the kind. */
export function activityTitle(a: Pick<ActivityRecord, 'kind' | 'name'>): string {
  const custom = a.name?.trim();
  return custom && custom.length > 0 ? custom : ACTIVITY_LABEL[a.kind] ?? 'Activity';
}

/** "3.2 mi · 4,800 steps · 410 cal" — only the parts that were recorded. */
export function activityMetrics(a: ActivityRecord): string {
  const parts: string[] = [];
  if (a.distance != null && a.distance > 0) {
    const n = Number(a.distance.toFixed(2));
    parts.push(`${n} ${a.distanceUnit ?? 'mi'}`);
  }
  if (a.steps != null && a.steps > 0) parts.push(`${a.steps.toLocaleString('en-US')} steps`);
  if (a.calories != null && a.calories > 0) parts.push(`${a.calories.toLocaleString('en-US')} cal`);
  return parts.join(' · ');
}

export interface ActivityDraft {
  kind: ActivityKind;
  name?: string | null;
  durationSeconds: number;
  distance?: number | null;
  distanceUnit?: DistanceUnit | null;
  steps?: number | null;
  calories?: number | null;
}

export interface ValidationResult {
  ok: boolean;
  /** Human-readable reason, when not ok. */
  error: string | null;
}

const MAX_SECONDS = 86_400 * 2 - 1;

/**
 * A draft is savable when it has a positive duration and no impossible
 * numbers. Optional metrics may be absent, but not negative.
 */
export function validateActivity(draft: ActivityDraft): ValidationResult {
  if (!Number.isFinite(draft.durationSeconds) || draft.durationSeconds <= 0) {
    return { ok: false, error: 'Add how long the activity lasted.' };
  }
  if (draft.durationSeconds > MAX_SECONDS) {
    return { ok: false, error: 'That duration is longer than two days.' };
  }
  for (const [label, value] of [
    ['Distance', draft.distance],
    ['Steps', draft.steps],
    ['Calories', draft.calories],
  ] as const) {
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      return { ok: false, error: `${label} can't be negative.` };
    }
  }
  return { ok: true, error: null };
}

/** Turn hours/minutes pickers into the seconds the record stores. */
export function toSeconds(hours: number, minutes: number): number {
  const h = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  return h * 3600 + m * 60;
}

/** Split seconds back into whole hours and leftover minutes, for editing. */
export function fromSeconds(seconds: number): { hours: number; minutes: number } {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return { hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60) };
}

export interface ActivityTotals {
  totalSeconds: number;
  count: number;
  /** Seconds per kind, for the profile breakdown. */
  byKind: Partial<Record<ActivityKind, number>>;
}

export function activityTotals(list: ActivityRecord[]): ActivityTotals {
  let totalSeconds = 0;
  const byKind: Partial<Record<ActivityKind, number>> = {};
  for (const a of list) {
    const s = Number.isFinite(a.durationSeconds) ? Math.max(0, a.durationSeconds) : 0;
    totalSeconds += s;
    byKind[a.kind] = (byKind[a.kind] ?? 0) + s;
  }
  return { totalSeconds, count: list.length, byKind };
}

/** The kind with the most time logged, for a "your sport" line. */
export function topKind(totals: ActivityTotals): ActivityKind | null {
  let best: ActivityKind | null = null;
  let bestSeconds = 0;
  for (const kind of ACTIVITY_KINDS) {
    const s = totals.byKind[kind] ?? 0;
    if (s > bestSeconds) {
      bestSeconds = s;
      best = kind;
    }
  }
  return best;
}
