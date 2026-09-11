/**
 * Trophies — pure, derived from stats the app already tracks. Nothing is
 * stored: recomputing keeps them honest if sets are edited or deleted.
 *
 * Most trophies are *tiered*: one trophy per lift (or milestone) that climbs
 * nine ranks from Wood to Legend, so a single Bench Press trophy carries you
 * from your first empty bar all the way to a 405.
 *
 * All thresholds are defined in POUNDS. A lifter working in kilos has their
 * value converted before comparison, so "a fully loaded semi truck" stays a
 * real semi truck rather than becoming 2.2x heavier.
 */

export const TIERS = [
  'wood',
  'stone',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'emerald',
  'ruby',
  'legend',
] as const;

export type Tier = (typeof TIERS)[number];

export const TIER_LABEL: Record<Tier, string> = {
  wood: 'Wood',
  stone: 'Stone',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  emerald: 'Emerald',
  ruby: 'Ruby',
  legend: 'Legend',
};

export const TIER_COLOR: Record<Tier, string> = {
  wood: '#8B5E3C',
  stone: '#8A94A0',
  silver: '#C7D2DC',
  gold: '#F0B429',
  platinum: '#7FE3D4',
  diamond: '#59C2FF',
  emerald: '#3DD68C',
  ruby: '#FF5C7A',
  legend: '#C77DFF',
};

export const LB_PER_KG = 2.20462;

/** Glyph keys — each maps to a drawn icon, never an emoji. */
export type TrophyGlyph =
  | 'bench'
  | 'squat'
  | 'deadlift'
  | 'press'
  | 'row'
  | 'pullup'
  | 'pushup'
  | 'dip'
  | 'truck'
  | 'flame'
  | 'calendar'
  | 'clock'
  | 'body'
  | 'stack'
  | 'shoe'
  | 'heart'
  // Added for badges and feed reactions; same 24x24 line-art grid as the rest.
  | 'arm'
  | 'plate'
  | 'clap'
  | 'star'
  | 'flask'
  | 'crown'
  | 'bolt'
  | 'shield';

export type TrophyFamily = 'lift' | 'calisthenics' | 'milestone' | 'consistency';

export interface TierStep {
  tier: Tier;
  /** In pounds for weight trophies; a raw count otherwise. */
  threshold: number;
  /** Real-world comparison shown under the number, e.g. "an African elephant". */
  note?: string;
}

export interface AchievementInput {
  totalWorkouts: number;
  totalVolume: number;
  totalReps: number;
  totalSets: number;
  totalSeconds: number;
  currentStreak: number;
  bestStreak: number;
  /** Distinct muscle groups trained in the current week. */
  groupsThisWeek: number;
  /** Total distinct muscle groups the app tracks. */
  groupsTotal: number;
  /** Heaviest working set per exercise, keyed by lowercased exercise name. */
  bestWeightByExercise: Record<string, number>;
  /** Most reps in a single set per exercise, keyed by lowercased name. */
  bestRepsByExercise: Record<string, number>;
  /** The unit the numbers above are recorded in. */
  unit: 'lb' | 'kg';
  /** Seconds of non-lifting activity (runs, sports, cardio machines). */
  activitySeconds: number;
  /** How many activities have been logged. */
  activityCount: number;
  /** Distinct activity kinds tried, for the variety trophy. */
  activityKinds: number;
}

export interface TieredAchievement {
  id: string;
  family: TrophyFamily;
  name: string;
  glyph: TrophyGlyph;
  /** Highest tier reached, or null if not even Wood yet. */
  tier: Tier | null;
  earned: boolean;
  /** Raw value on the ladder's own scale. */
  value: number;
  /** e.g. "185 lb" or "12 reps". */
  valueLabel: string;
  /** Null once every tier is cleared. */
  next: { tier: Tier; threshold: number; note?: string; label: string } | null;
  /** 0..1 from the last tier cleared toward the next (1 when maxed). */
  progress: number;
  /** How many of the nine tiers are cleared. */
  tiersEarned: number;
  tiersTotal: number;
  /** The full ladder, for the detail view. */
  steps: (TierStep & { earned: boolean; label: string })[];
}

// --- Ladders ----------------------------------------------------------------

const ladder = (values: number[], notes?: string[]): TierStep[] =>
  TIERS.map((tier, i) => ({ tier, threshold: values[i], note: notes?.[i] }));

interface LiftDef {
  id: string;
  name: string;
  glyph: TrophyGlyph;
  /** Matched case-insensitively against the exercise name. */
  exercise: string;
  steps: TierStep[];
}

/**
 * Barbell ladders use real plate-loadable numbers, scaled off the bench
 * progression the way these lifts usually relate to each other.
 */
const LIFTS: LiftDef[] = [
  {
    id: 'lift-bench',
    name: 'Bench Press',
    glyph: 'bench',
    exercise: 'barbell bench press',
    steps: ladder([45, 95, 135, 185, 225, 275, 315, 385, 405]),
  },
  {
    id: 'lift-squat',
    name: 'Back Squat',
    glyph: 'squat',
    exercise: 'barbell back squat',
    steps: ladder([45, 135, 185, 225, 275, 315, 405, 495, 585]),
  },
  {
    id: 'lift-deadlift',
    name: 'Deadlift',
    glyph: 'deadlift',
    exercise: 'conventional deadlift',
    steps: ladder([95, 135, 225, 275, 315, 405, 495, 585, 675]),
  },
  {
    id: 'lift-press',
    name: 'Overhead Press',
    glyph: 'press',
    exercise: 'overhead press',
    steps: ladder([45, 65, 95, 115, 135, 155, 185, 225, 245]),
  },
  {
    id: 'lift-row',
    name: 'Barbell Row',
    glyph: 'row',
    exercise: 'bent-over barbell row',
    steps: ladder([45, 95, 135, 155, 185, 225, 275, 315, 365]),
  },
];

interface CalisthenicsDef {
  id: string;
  name: string;
  glyph: TrophyGlyph;
  exercise: string;
  steps: TierStep[];
}

/** Judged on the most reps done in a single set. */
const CALISTHENICS: CalisthenicsDef[] = [
  {
    id: 'cal-pullup',
    name: 'Pull-Ups',
    glyph: 'pullup',
    exercise: 'pull-up',
    steps: ladder([1, 3, 5, 8, 12, 15, 20, 25, 30]),
  },
  {
    id: 'cal-pushup',
    name: 'Push-Ups',
    glyph: 'pushup',
    exercise: 'push-up',
    steps: ladder([5, 10, 20, 30, 50, 75, 100, 125, 150]),
  },
  {
    id: 'cal-dip',
    name: 'Dips',
    glyph: 'dip',
    exercise: 'dip',
    steps: ladder([1, 3, 5, 10, 15, 20, 25, 35, 50]),
  },
];

/**
 * Lifetime volume, measured against things that actually weigh this much.
 * The figures are real: a US semi is capped at 80,000 lb by federal law, a
 * 747-400's maximum takeoff weight is 875,000 lb, and the Eiffel Tower's iron
 * structure plus its foundations comes to roughly 22 million pounds.
 */
const VOLUME_STEPS: TierStep[] = ladder(
  [1_000, 2_900, 5_000, 13_000, 25_000, 80_000, 450_000, 875_000, 22_000_000],
  [
    'a horse',
    'a Honda Civic',
    'a Ford F-150',
    'an African elephant',
    'a loaded school bus',
    'a semi truck at the legal limit',
    'the Statue of Liberty',
    'a Boeing 747-400',
    'the Eiffel Tower',
  ],
);

const WORKOUT_STEPS = ladder([1, 5, 10, 25, 50, 100, 200, 365, 500]);
const STREAK_STEPS = ladder([2, 3, 5, 7, 14, 30, 60, 100, 365]);
const HOUR_STEPS = ladder([1, 5, 10, 25, 50, 100, 250, 500, 1000]);
const SET_STEPS = ladder([10, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000]);
// Activity ladders. Hours mirror the lifting time ladder so the two read
// alike on the profile; the variety ladder tops out at the 16 kinds offered.
const ACTIVITY_HOUR_STEPS = ladder([1, 5, 10, 25, 50, 100, 250, 500, 1000]);
const ACTIVITY_COUNT_STEPS = ladder([1, 5, 10, 25, 50, 100, 250, 500, 1000]);
const ACTIVITY_KIND_STEPS = ladder([1, 2, 3, 4, 6, 8, 10, 13, 16]);

const REP_STEPS = ladder([100, 500, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000]);

// --- Formatting -------------------------------------------------------------

function comma(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  return comma(n);
}

function formatHours(seconds: number): string {
  const h = seconds / 3600;
  return h >= 10 ? `${Math.round(h)}h` : `${Number(h.toFixed(1))}h`;
}

// --- Evaluation -------------------------------------------------------------

interface BuildArgs {
  id: string;
  family: TrophyFamily;
  name: string;
  glyph: TrophyGlyph;
  steps: TierStep[];
  /** Value already normalised to the ladder's own scale. */
  value: number;
  formatValue: (n: number) => string;
  formatThreshold: (n: number) => string;
}

function build(args: BuildArgs): TieredAchievement {
  const { steps, value } = args;

  let tier: Tier | null = null;
  let tiersEarned = 0;
  const decorated = steps.map((s) => {
    const earned = value >= s.threshold;
    if (earned) {
      tier = s.tier;
      tiersEarned += 1;
    }
    return { ...s, earned, label: args.formatThreshold(s.threshold) };
  });

  const nextStep = steps.find((s) => value < s.threshold) ?? null;
  const prevThreshold = tiersEarned > 0 ? steps[tiersEarned - 1].threshold : 0;

  let progress = 1;
  if (nextStep) {
    const span = nextStep.threshold - prevThreshold;
    progress = span <= 0 ? 0 : Math.min(1, Math.max(0, (value - prevThreshold) / span));
  }

  return {
    id: args.id,
    family: args.family,
    name: args.name,
    glyph: args.glyph,
    tier,
    earned: tier !== null,
    value,
    valueLabel: args.formatValue(value),
    next: nextStep
      ? {
          tier: nextStep.tier,
          threshold: nextStep.threshold,
          note: nextStep.note,
          label: args.formatThreshold(nextStep.threshold),
        }
      : null,
    progress,
    tiersEarned,
    tiersTotal: steps.length,
    steps: decorated,
  };
}

/** Look up a best value by exercise name, case-insensitively. */
function lookup(map: Record<string, number>, name: string): number {
  return map[name.toLowerCase()] ?? 0;
}

export function evaluateAchievements(input: AchievementInput): TieredAchievement[] {
  const toLb = (n: number) => (input.unit === 'kg' ? n * LB_PER_KG : n);
  const fromLb = (n: number) => (input.unit === 'kg' ? n / LB_PER_KG : n);
  const weightLabel = (lb: number) => `${compactNumber(fromLb(lb))} ${input.unit}`;

  const out: TieredAchievement[] = [];

  for (const lift of LIFTS) {
    const best = lookup(input.bestWeightByExercise, lift.exercise);
    out.push(
      build({
        id: lift.id,
        family: 'lift',
        name: lift.name,
        glyph: lift.glyph,
        steps: lift.steps,
        value: toLb(best),
        formatValue: () => (best > 0 ? `${comma(best)} ${input.unit}` : '—'),
        formatThreshold: weightLabel,
      }),
    );
  }

  for (const cal of CALISTHENICS) {
    const best = lookup(input.bestRepsByExercise, cal.exercise);
    out.push(
      build({
        id: cal.id,
        family: 'calisthenics',
        name: cal.name,
        glyph: cal.glyph,
        steps: cal.steps,
        value: best,
        formatValue: (n) => (n > 0 ? `${comma(n)} reps` : '—'),
        formatThreshold: (n) => `${comma(n)} reps`,
      }),
    );
  }

  out.push(
    build({
      id: 'total-volume',
      family: 'milestone',
      name: 'Total Weight Lifted',
      glyph: 'truck',
      steps: VOLUME_STEPS,
      value: toLb(input.totalVolume),
      formatValue: () => `${compactNumber(input.totalVolume)} ${input.unit}`,
      formatThreshold: weightLabel,
    }),
    build({
      id: 'total-workouts',
      family: 'consistency',
      name: 'Workouts',
      glyph: 'calendar',
      steps: WORKOUT_STEPS,
      value: input.totalWorkouts,
      formatValue: (n) => comma(n),
      formatThreshold: (n) => comma(n),
    }),
    build({
      id: 'best-streak',
      family: 'consistency',
      name: 'Day Streak',
      glyph: 'flame',
      steps: STREAK_STEPS,
      value: input.bestStreak,
      formatValue: (n) => `${comma(n)} days`,
      formatThreshold: (n) => `${comma(n)} days`,
    }),
    build({
      id: 'total-hours',
      family: 'milestone',
      name: 'Time Training',
      glyph: 'clock',
      steps: HOUR_STEPS,
      value: input.totalSeconds / 3600,
      formatValue: () => formatHours(input.totalSeconds),
      formatThreshold: (n) => `${comma(n)}h`,
    }),
    build({
      id: 'total-sets',
      family: 'milestone',
      name: 'Sets Logged',
      glyph: 'stack',
      steps: SET_STEPS,
      value: input.totalSets,
      formatValue: (n) => comma(n),
      formatThreshold: compactNumber,
    }),
    build({
      id: 'activity-hours',
      family: 'milestone',
      name: 'Activity Time',
      glyph: 'shoe',
      steps: ACTIVITY_HOUR_STEPS,
      value: input.activitySeconds / 3600,
      formatValue: () => formatHours(input.activitySeconds),
      formatThreshold: (n) => `${comma(n)}h`,
    }),
    build({
      id: 'activity-count',
      family: 'milestone',
      name: 'Activities Logged',
      glyph: 'heart',
      steps: ACTIVITY_COUNT_STEPS,
      value: input.activityCount,
      formatValue: (n) => comma(n),
      formatThreshold: compactNumber,
    }),
    build({
      id: 'activity-variety',
      family: 'milestone',
      name: 'Cross-Trainer',
      glyph: 'heart',
      steps: ACTIVITY_KIND_STEPS,
      value: input.activityKinds,
      formatValue: (n) => `${comma(n)} kinds`,
      formatThreshold: (n) => `${comma(n)} kinds`,
    }),
    build({
      id: 'total-reps',
      family: 'milestone',
      name: 'Reps Logged',
      glyph: 'body',
      steps: REP_STEPS,
      value: input.totalReps,
      formatValue: (n) => comma(n),
      formatThreshold: compactNumber,
    }),
  );

  return out;
}

/** Trophies at Wood or above. */
export function earnedCount(list: TieredAchievement[]): number {
  return list.filter((a) => a.earned).length;
}

/** Every tier cleared across every trophy — the real "collection" score. */
export function totalTiersEarned(list: TieredAchievement[]): number {
  return list.reduce((n, a) => n + a.tiersEarned, 0);
}

export function totalTiersAvailable(list: TieredAchievement[]): number {
  return list.reduce((n, a) => n + a.tiersTotal, 0);
}

/** Highest-ranked trophies first — what to show on a profile strip. */
export function topAchievements(
  list: TieredAchievement[],
  limit = 6,
): TieredAchievement[] {
  return [...list]
    .filter((a) => a.earned)
    .sort((a, b) => b.tiersEarned - a.tiersEarned)
    .slice(0, limit);
}

/**
 * Share of the last `windowDays` days that had a workout, as 0..1.
 * This is the "consistency" figure shown on profiles.
 */
export function consistency(
  workoutDates: string[],
  today: string,
  windowDays = 30,
): number {
  if (windowDays <= 0) return 0;
  const days = new Set(workoutDates);
  const end = new Date(`${today}T00:00:00Z`).getTime();
  if (Number.isNaN(end)) return 0;

  let hits = 0;
  for (let i = 0; i < windowDays; i += 1) {
    const d = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    if (days.has(d)) hits += 1;
  }
  return hits / windowDays;
}
