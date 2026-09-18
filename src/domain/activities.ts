/**
 * Non-lifting activities — running, stair master, five-a-side, whatever.
 * Pure helpers only: labels, validation and aggregation. The timer itself
 * lives in the UI; this module just deals in seconds.
 */

/**
 * Every kind the database accepts. New values are appended before 'other' so
 * the order matches the enum's history; the form shows them by group instead.
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
  'pickleball',
  'volleyball',
  'baseball',
  'softball',
  'football',
  'hockey',
  'golf',
  'badminton',
  'table_tennis',
  'racquetball',
  'squash',
  'lacrosse',
  'rugby',
  'ultimate_frisbee',
  'wrestling',
  'martial_arts',
  'skiing',
  'snowboarding',
  'skating',
  'skateboarding',
  'surfing',
  'kayaking',
  'paddleboarding',
  'spin',
  'hiit',
  'crossfit',
  'pilates',
  'dance',
  'stretching',
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
  pickleball: 'Pickleball',
  volleyball: 'Volleyball',
  baseball: 'Baseball',
  softball: 'Softball',
  football: 'Football',
  hockey: 'Hockey',
  golf: 'Golf',
  badminton: 'Badminton',
  table_tennis: 'Table Tennis',
  racquetball: 'Racquetball',
  squash: 'Squash',
  lacrosse: 'Lacrosse',
  rugby: 'Rugby',
  ultimate_frisbee: 'Ultimate Frisbee',
  wrestling: 'Wrestling',
  martial_arts: 'Martial Arts',
  skiing: 'Skiing',
  snowboarding: 'Snowboarding',
  skating: 'Skating',
  skateboarding: 'Skateboarding',
  surfing: 'Surfing',
  kayaking: 'Kayaking',
  paddleboarding: 'Paddleboarding',
  spin: 'Spin Class',
  hiit: 'HIIT',
  crossfit: 'CrossFit',
  pilates: 'Pilates',
  dance: 'Dance',
  stretching: 'Stretching',
  other: 'Other',
};

/** How the activity form lays the kinds out. Every kind appears exactly once. */
export const ACTIVITY_GROUPS: readonly { title: string; kinds: readonly ActivityKind[] }[] = [
  {
    title: 'Cardio',
    kinds: ['run', 'walk', 'hike', 'cycle', 'swim', 'row', 'stairmaster', 'elliptical', 'jump_rope'],
  },
  {
    title: 'Classes',
    kinds: ['spin', 'hiit', 'crossfit', 'yoga', 'pilates', 'dance', 'stretching'],
  },
  {
    title: 'Racquet sports',
    kinds: ['pickleball', 'tennis', 'badminton', 'table_tennis', 'racquetball', 'squash'],
  },
  {
    title: 'Team sports',
    kinds: [
      'basketball',
      'soccer',
      'football',
      'volleyball',
      'baseball',
      'softball',
      'hockey',
      'lacrosse',
      'rugby',
      'ultimate_frisbee',
    ],
  },
  { title: 'Combat', kinds: ['boxing', 'martial_arts', 'wrestling'] },
  {
    title: 'Outdoors',
    kinds: [
      'climbing',
      'golf',
      'skiing',
      'snowboarding',
      'skating',
      'skateboarding',
      'surfing',
      'kayaking',
      'paddleboarding',
    ],
  },
  { title: 'Something else', kinds: ['other'] },
];

type Fields = { distance: boolean; steps: boolean; calories: boolean };
const TIMED: Fields = { distance: false, steps: false, calories: true };
const RANGED: Fields = { distance: true, steps: false, calories: true };
const ON_FOOT: Fields = { distance: true, steps: true, calories: true };

/**
 * Which optional metrics are worth offering for each kind. Everything stays
 * optional — this only decides what the form shows by default, so a basketball
 * game does not ask for distance.
 */
export const ACTIVITY_FIELDS: Record<ActivityKind, Fields> = {
  run: ON_FOOT,
  walk: ON_FOOT,
  hike: ON_FOOT,
  cycle: RANGED,
  swim: RANGED,
  row: RANGED,
  stairmaster: { distance: false, steps: true, calories: true },
  elliptical: RANGED,
  jump_rope: TIMED,
  basketball: TIMED,
  soccer: RANGED,
  tennis: TIMED,
  boxing: TIMED,
  climbing: TIMED,
  yoga: TIMED,
  pickleball: TIMED,
  volleyball: TIMED,
  baseball: TIMED,
  softball: TIMED,
  football: TIMED,
  hockey: TIMED,
  golf: ON_FOOT,
  badminton: TIMED,
  table_tennis: TIMED,
  racquetball: TIMED,
  squash: TIMED,
  lacrosse: TIMED,
  rugby: TIMED,
  ultimate_frisbee: TIMED,
  wrestling: TIMED,
  martial_arts: TIMED,
  skiing: RANGED,
  snowboarding: TIMED,
  skating: RANGED,
  skateboarding: RANGED,
  surfing: TIMED,
  kayaking: RANGED,
  paddleboarding: RANGED,
  spin: RANGED,
  hiit: TIMED,
  crossfit: TIMED,
  pilates: TIMED,
  dance: TIMED,
  stretching: TIMED,
  other: ON_FOOT,
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
