/**
 * Experience points and levels.
 *
 * XP is *derived*, never stored — exactly like trophies. Recomputing from the
 * user's own totals means XP cannot be farmed, cannot drift, and corrects
 * itself if sets are edited or deleted. It also means a friend's level is
 * computed by this same code from the aggregates the server returns, so the
 * number on their profile can never disagree with the number on their own.
 *
 * Every weight figure is normalised to POUNDS before it scores, so a lifter
 * working in kilos is not handed 2.2x the XP for the same work.
 */

export const LB_PER_KG = 2.20462;

// --- Earning rates ----------------------------------------------------------
// Tuned so someone training three times a week climbs quickly for the first
// month and then slows, which is where the level curve takes over.

export const XP_PER_WORKOUT = 100;
export const XP_PER_SET = 2;
/** Volume is a big number, so it scores per thousand pounds moved. */
export const XP_PER_1000LB = 5;
export const XP_PER_ACTIVITY = 60;
export const XP_PER_TROPHY_TIER = 75;
export const XP_PER_STREAK_DAY = 20;
export const XP_PER_FRIEND = 50;
/**
 * Adding friends is the one source a user can spam, so it is capped. Ten
 * friends is generous for the bonus and worthless as a farming strategy.
 */
export const MAX_FRIEND_XP = 500;
/**
 * Personal records score through summed best estimated 1RM across exercises.
 * That number only moves when you actually beat a previous best, so it rewards
 * every genuine PR automatically without storing PR events that could go stale.
 */
export const XP_PER_LB_STRENGTH = 0.5;

export const MAX_LEVEL = 100;

export interface XpInput {
  totalWorkouts: number;
  totalSets: number;
  /** Lifetime volume, in `unit`. */
  totalVolume: number;
  totalActivities: number;
  /** Longest run of training days ever reached. */
  bestStreak: number;
  /** Accepted friendships. */
  friendCount: number;
  /** Trophy tiers cleared, across every trophy. */
  trophyTiers: number;
  /** Sum of the best estimated 1RM per exercise, in `unit`. */
  strengthScore: number;
  unit: 'lb' | 'kg';
}

export type XpSourceId =
  | 'workouts'
  | 'sets'
  | 'volume'
  | 'records'
  | 'trophies'
  | 'streak'
  | 'activities'
  | 'friends';

export interface XpSource {
  id: XpSourceId;
  label: string;
  /** What produced it, e.g. "48 sessions". */
  detail: string;
  xp: number;
}

export interface XpBreakdown {
  total: number;
  sources: XpSource[];
}

const comma = (n: number) => Math.round(n).toLocaleString('en-US');

function plural(n: number, singular: string, pluralForm?: string): string {
  const rounded = Math.round(n);
  const word = rounded === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${comma(n)} ${word}`;
}

/** Everything scores in pounds; a kilo user's numbers are converted first. */
function toLb(value: number, unit: 'lb' | 'kg'): number {
  return unit === 'kg' ? value * LB_PER_KG : value;
}

export function computeXp(input: XpInput): XpBreakdown {
  const volumeLb = toLb(Math.max(0, input.totalVolume), input.unit);
  const strengthLb = toLb(Math.max(0, input.strengthScore), input.unit);
  const friends = Math.max(0, input.friendCount);

  const sources: XpSource[] = [
    {
      id: 'workouts',
      label: 'Workouts',
      detail: plural(input.totalWorkouts, 'session'),
      xp: Math.max(0, Math.round(input.totalWorkouts * XP_PER_WORKOUT)),
    },
    {
      id: 'sets',
      label: 'Sets logged',
      detail: plural(input.totalSets, 'set'),
      xp: Math.max(0, Math.round(input.totalSets * XP_PER_SET)),
    },
    {
      id: 'volume',
      label: 'Weight moved',
      detail: `${comma(Math.max(0, input.totalVolume))} ${input.unit}`,
      xp: Math.max(0, Math.round((volumeLb / 1000) * XP_PER_1000LB)),
    },
    {
      id: 'records',
      label: 'Personal records',
      detail: `${comma(Math.max(0, input.strengthScore))} ${input.unit} of best lifts`,
      xp: Math.max(0, Math.round(strengthLb * XP_PER_LB_STRENGTH)),
    },
    {
      id: 'trophies',
      label: 'Trophies',
      detail: plural(input.trophyTiers, 'tier'),
      xp: Math.max(0, Math.round(input.trophyTiers * XP_PER_TROPHY_TIER)),
    },
    {
      id: 'streak',
      label: 'Best streak',
      detail: plural(input.bestStreak, 'day'),
      xp: Math.max(0, Math.round(input.bestStreak * XP_PER_STREAK_DAY)),
    },
    {
      id: 'activities',
      label: 'Activities',
      detail: plural(input.totalActivities, 'activity', 'activities'),
      xp: Math.max(0, Math.round(input.totalActivities * XP_PER_ACTIVITY)),
    },
    {
      id: 'friends',
      label: 'Friends',
      detail: plural(friends, 'friend'),
      xp: Math.min(MAX_FRIEND_XP, Math.round(friends * XP_PER_FRIEND)),
    },
  ];

  return {
    total: sources.reduce((sum, s) => sum + s.xp, 0),
    sources,
  };
}

// --- The level curve --------------------------------------------------------

/**
 * Total XP needed to *reach* a level: `50 * L * (L - 1)`.
 *
 * That is a plain quadratic, which means each level costs 100 XP more than the
 * one before it — level 2 at 100, level 5 at 1,000, level 20 at 19,000,
 * level 100 at 495,000. Fast at the start, a genuine grind at the top, and
 * simple enough to invert exactly.
 */
export function cumulativeXpForLevel(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return 50 * l * (l - 1);
}

/**
 * Inverse of the curve. Solved directly, then nudged against
 * `cumulativeXpForLevel`, because floating-point sqrt can land a hair under an
 * exact boundary and silently cost someone the level they just earned.
 */
export function levelForXp(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 1;
  let level = Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2);
  level = Math.max(1, Math.min(MAX_LEVEL, level));
  while (level < MAX_LEVEL && xp >= cumulativeXpForLevel(level + 1)) level += 1;
  while (level > 1 && xp < cumulativeXpForLevel(level)) level -= 1;
  return level;
}

export interface LevelProgress {
  level: number;
  /** Total lifetime XP. */
  xp: number;
  /** XP earned since this level started. */
  xpIntoLevel: number;
  /** What this level costs end to end, or 0 at the cap. */
  xpForLevel: number;
  /** Still needed for the next level, or 0 at the cap. */
  xpToNext: number;
  /** 0..1 across the current level; 1 at the cap. */
  progress: number;
  maxed: boolean;
  title: string;
}

const TITLES: { from: number; title: string }[] = [
  { from: 100, title: 'Legend' },
  { from: 90, title: 'Master' },
  { from: 75, title: 'Elite' },
  { from: 60, title: 'Veteran' },
  { from: 45, title: 'Seasoned' },
  { from: 30, title: 'Strong' },
  { from: 20, title: 'Regular' },
  { from: 10, title: 'Lifter' },
  { from: 5, title: 'Novice' },
  { from: 1, title: 'Newcomer' },
];

export function levelTitle(level: number): string {
  return TITLES.find((t) => level >= t.from)?.title ?? 'Newcomer';
}

export function levelProgress(xp: number): LevelProgress {
  const total = Math.max(0, Math.round(xp));
  const level = levelForXp(total);
  const maxed = level >= MAX_LEVEL;

  const floor = cumulativeXpForLevel(level);
  const ceiling = maxed ? floor : cumulativeXpForLevel(level + 1);
  const xpForLevel = maxed ? 0 : ceiling - floor;
  const xpIntoLevel = maxed ? 0 : total - floor;

  return {
    level,
    xp: total,
    xpIntoLevel,
    xpForLevel,
    xpToNext: maxed ? 0 : Math.max(0, ceiling - total),
    progress: maxed || xpForLevel <= 0 ? 1 : Math.min(1, Math.max(0, xpIntoLevel / xpForLevel)),
    maxed,
    title: levelTitle(level),
  };
}

// --- What a single session was worth ----------------------------------------

/** A PR is paid a flat bonus on the summary screen. */
export const XP_PER_RECORD = 150;

export interface SessionXpInput {
  /** Working sets logged in this session. */
  sets: number;
  /** Volume for this session, in `unit`. */
  volume: number;
  /** Personal records set during it. */
  records: number;
  unit: 'lb' | 'kg';
}

/**
 * XP attributable to one finished workout, for the post-workout screen.
 *
 * This is the session's *own* contribution rather than a recomputation of
 * lifetime XP, so the figure stays stable even though trophies and streaks may
 * also have moved. A PR's lasting value arrives separately, through the
 * strength score in `computeXp`.
 */
export function sessionXp(input: SessionXpInput): XpBreakdown {
  const volumeLb = toLb(Math.max(0, input.volume), input.unit);

  const sources: XpSource[] = [
    {
      id: 'workouts',
      label: 'Finished the session',
      detail: '',
      xp: XP_PER_WORKOUT,
    },
    {
      id: 'sets',
      label: 'Sets logged',
      detail: plural(input.sets, 'set'),
      xp: Math.max(0, Math.round(input.sets * XP_PER_SET)),
    },
    {
      id: 'volume',
      label: 'Weight moved',
      detail: `${comma(Math.max(0, input.volume))} ${input.unit}`,
      xp: Math.max(0, Math.round((volumeLb / 1000) * XP_PER_1000LB)),
    },
  ];

  if (input.records > 0) {
    sources.push({
      id: 'records',
      label: 'Personal records',
      detail: plural(input.records, 'record'),
      xp: Math.round(input.records * XP_PER_RECORD),
    });
  }

  return { total: sources.reduce((sum, s) => sum + s.xp, 0), sources };
}

/** Sum of the best estimated 1RM across exercises — the "records" XP source. */
export function strengthScore(bestE1rmByExercise: Record<string, number>): number {
  return Object.values(bestE1rmByExercise).reduce(
    (sum, v) => sum + (Number.isFinite(v) && v > 0 ? v : 0),
    0,
  );
}
