/**
 * The friends leaderboard: you and your friends, ranked on one figure at a
 * time. Pure, so the ranking and the unit conversion can be tested.
 */

import { formatDurationShort } from './duration';

export const LEADERBOARD_METRICS = [
  'streak',
  'volume',
  'workoutTime',
  'consistency',
  'activityTime',
] as const;
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];

export const METRIC_LABEL: Record<LeaderboardMetric, string> = {
  streak: 'Current streak',
  volume: 'Weight lifted',
  workoutTime: 'Workout time',
  consistency: 'Consistency',
  activityTime: 'Activity time',
};

/** Streak and consistency describe right now; the totals can be windowed. */
export const METRIC_HAS_PERIOD: Record<LeaderboardMetric, boolean> = {
  streak: false,
  volume: true,
  workoutTime: true,
  consistency: false,
  activityTime: true,
};

/** The window consistency is measured over, in days. */
export const CONSISTENCY_WINDOW_DAYS = 30;

export const LEADERBOARD_PERIODS = ['week', 'month', 'all'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export const PERIOD_LABEL: Record<LeaderboardPeriod, string> = {
  week: '7 days',
  month: '30 days',
  all: 'All time',
};

/** Start of the window, or null for all time. */
export function periodSince(period: LeaderboardPeriod, nowMs: number): Date | null {
  if (period === 'all') return null;
  const days = period === 'week' ? 7 : 30;
  return new Date(nowMs - days * 86_400_000);
}

const LB_PER_KG = 2.20462;

export interface LeaderboardPerson {
  userId: string;
  username: string;
  displayName: string | null;
  /** The unit this person logs in; their volume is in it. */
  unit: 'lb' | 'kg';
  isMe: boolean;
  totalVolume: number;
  workoutSeconds: number;
  activitySeconds: number;
  /** Training days in the current run; rest days keep it alive but add nothing. */
  currentStreak: number;
  /** Share of the last 30 days trained or rested, 0..100. */
  consistency: number;
}

export interface LeaderboardRow {
  /** 1-based. People with the same value share a rank: 1, 1, 3. */
  rank: number;
  person: LeaderboardPerson;
  value: number;
}

/** Converts a volume into the viewer's unit, so kg and lb lifters compare fairly. */
export function convertVolume(volume: number, from: 'lb' | 'kg', to: 'lb' | 'kg'): number {
  if (from === to) return volume;
  return from === 'kg' ? volume * LB_PER_KG : volume / LB_PER_KG;
}

export function metricValue(
  person: LeaderboardPerson,
  metric: LeaderboardMetric,
  viewerUnit: 'lb' | 'kg',
): number {
  switch (metric) {
    case 'streak':
      return person.currentStreak;
    case 'volume':
      return Math.round(convertVolume(person.totalVolume, person.unit, viewerUnit));
    case 'workoutTime':
      return person.workoutSeconds;
    case 'consistency':
      return person.consistency;
    case 'activityTime':
      return person.activitySeconds;
  }
}

/**
 * Highest first. Equal values share a rank, and within a tie the order is by
 * username so it does not shuffle between refreshes.
 */
export function rankLeaderboard(
  people: LeaderboardPerson[],
  metric: LeaderboardMetric,
  viewerUnit: 'lb' | 'kg',
): LeaderboardRow[] {
  const scored = people
    .map((person) => ({ person, value: metricValue(person, metric, viewerUnit) }))
    .sort((a, b) => b.value - a.value || a.person.username.localeCompare(b.person.username));

  const rows: LeaderboardRow[] = [];
  scored.forEach((s, i) => {
    const rank = i > 0 && s.value === scored[i - 1].value ? rows[i - 1].rank : i + 1;
    rows.push({ rank, person: s.person, value: s.value });
  });
  return rows;
}

export function formatMetric(value: number, metric: LeaderboardMetric, unit: 'lb' | 'kg'): string {
  switch (metric) {
    case 'streak':
      return `${value} day${value === 1 ? '' : 's'}`;
    case 'volume':
      return `${compactNumber(value)} ${unit}`;
    case 'consistency':
      return `${value}%`;
    case 'workoutTime':
    case 'activityTime':
      return value <= 0 ? '0m' : formatDurationShort(value);
  }
}

/** A one-line note under the list saying what the figure means. */
export function metricNote(metric: LeaderboardMetric, period: LeaderboardPeriod): string {
  switch (metric) {
    case 'streak':
      return 'Workout days in a row. A rest day keeps a streak going but does not add to it.';
    case 'consistency':
      return `Share of the last ${CONSISTENCY_WINDOW_DAYS} days with a finished workout or a rest day.`;
    case 'volume':
      return `Weight × reps across finished workouts, ${periodPhrase(period)}. Converted to your unit.`;
    case 'workoutTime':
      return `Time in finished workouts, ${periodPhrase(period)}.`;
    case 'activityTime':
      return `Time in logged activities, ${periodPhrase(period)}.`;
  }
}

function periodPhrase(period: LeaderboardPeriod): string {
  return period === 'all' ? 'all time' : `last ${period === 'week' ? 7 : 30} days`;
}

/** Local so the domain layer imports nothing from the app. */
function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(0)}k`;
  return Math.round(n).toLocaleString();
}
