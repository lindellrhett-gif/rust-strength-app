/**
 * The friend feed — shaping server rows into the cards the Friends tab shows.
 *
 * A post is a *summary*, never a set-by-set replay. Friends see what someone
 * trained and how much work it was; they do not get a window into every rep.
 * That line is drawn here and again in SQL, so loosening one alone changes
 * nothing.
 */

import { formatClock } from './duration';
import type { TrophyGlyph } from './achievements';

export type FeedSubjectType = 'workout' | 'activity';

/** The reaction set. Drawn glyphs, not emoji, to match the trophies. */
export type ReactionId = 'fire' | 'strong' | 'heavy' | 'respect';

export interface ReactionDef {
  id: ReactionId;
  label: string;
  glyph: TrophyGlyph;
  /** Tint when the viewer has picked it. */
  color: string;
}

export const REACTIONS: ReactionDef[] = [
  { id: 'fire', label: 'On fire', glyph: 'flame', color: '#F2854C' },
  { id: 'strong', label: 'Strong', glyph: 'arm', color: '#3DD68C' },
  { id: 'heavy', label: 'Heavy', glyph: 'plate', color: '#59C2FF' },
  { id: 'respect', label: 'Respect', glyph: 'clap', color: '#F0B429' },
];

export const REACTION_IDS: ReactionId[] = REACTIONS.map((r) => r.id);

export function isReactionId(value: string): value is ReactionId {
  return (REACTION_IDS as string[]).includes(value);
}

/** One row exactly as `rpc_friend_feed` returns it. */
export interface FeedRow {
  subjectType: FeedSubjectType;
  subjectId: string;
  userId: string;
  username: string;
  displayName: string | null;
  occurredAt: string;
  name: string | null;
  durationSeconds: number;
  volume: number;
  totalSets: number;
  totalReps: number;
  exerciseNames: string[];
  recordCount: number;
  activityKind: string | null;
  distance: number | null;
  distanceUnit: string | null;
  /** Awarded badge ids held by the author, e.g. ["influencer"]. */
  badgeIds: string[];
  reactionCounts: Partial<Record<ReactionId, number>>;
  myReaction: ReactionId | null;
}

export interface FeedStat {
  label: string;
  value: string;
}

export interface FeedPost {
  key: string;
  subjectType: FeedSubjectType;
  subjectId: string;
  userId: string;
  username: string;
  displayName: string | null;
  occurredAt: string;
  /** What the card is called: the preset name, the activity, or a fallback. */
  title: string;
  /** One line under the title, e.g. "3 personal records". */
  headline: string | null;
  stats: FeedStat[];
  /** Up to four exercise names, for the chip row. */
  exercises: string[];
  /** How many more exercises the chips are hiding. */
  moreExercises: number;
  recordCount: number;
  badgeIds: string[];
  reactionCounts: Partial<Record<ReactionId, number>>;
  totalReactions: number;
  myReaction: ReactionId | null;
}

const MAX_EXERCISE_CHIPS = 4;

const comma = (n: number) => Math.round(n).toLocaleString('en-US');

const ACTIVITY_LABELS: Record<string, string> = {
  run: 'Run',
  walk: 'Walk',
  hike: 'Hike',
  cycle: 'Cycle',
  swim: 'Swim',
  row: 'Row',
  stairmaster: 'Stair master',
  elliptical: 'Elliptical',
  jump_rope: 'Jump rope',
  basketball: 'Basketball',
  soccer: 'Soccer',
  tennis: 'Tennis',
  boxing: 'Boxing',
  climbing: 'Climbing',
  yoga: 'Yoga',
  other: 'Activity',
};

export function activityLabel(kind: string | null): string {
  if (!kind) return 'Activity';
  return ACTIVITY_LABELS[kind] ?? 'Activity';
}

/** The card's title: an explicit name wins, then the activity kind, then a default. */
export function postTitle(row: FeedRow): string {
  const named = row.name?.trim();
  if (named) return named;
  if (row.subjectType === 'activity') return activityLabel(row.activityKind);
  return 'Workout';
}

/**
 * The line under the title. Personal records outrank everything, because that
 * is the thing a friend would actually want to say something about.
 */
export function postHeadline(row: FeedRow): string | null {
  if (row.subjectType === 'workout') {
    if (row.recordCount >= 3) return `${row.recordCount} personal records — huge session`;
    if (row.recordCount === 2) return 'Two personal records';
    if (row.recordCount === 1) return 'New personal record';
    if (row.totalSets >= 20) return 'Big volume day';
    return null;
  }
  if (row.distance != null && row.distance > 0 && row.distanceUnit) {
    return `${Number(row.distance.toFixed(2))} ${row.distanceUnit}`;
  }
  return null;
}

export function postStats(row: FeedRow, unit: 'lb' | 'kg'): FeedStat[] {
  const stats: FeedStat[] = [];

  if (row.durationSeconds > 0) {
    stats.push({ label: 'time', value: formatClock(row.durationSeconds) });
  }
  if (row.subjectType === 'workout') {
    if (row.volume > 0) stats.push({ label: `${unit} moved`, value: comma(row.volume) });
    if (row.totalSets > 0) stats.push({ label: 'sets', value: comma(row.totalSets) });
    if (row.totalReps > 0) stats.push({ label: 'reps', value: comma(row.totalReps) });
  } else if (row.distance != null && row.distance > 0 && row.distanceUnit) {
    stats.push({ label: row.distanceUnit, value: String(Number(row.distance.toFixed(2))) });
  }

  return stats;
}

export function totalReactions(counts: Partial<Record<ReactionId, number>>): number {
  return REACTION_IDS.reduce((sum, id) => sum + (counts[id] ?? 0), 0);
}

export function buildFeed(rows: FeedRow[], unit: 'lb' | 'kg'): FeedPost[] {
  return rows.map((row) => ({
    key: `${row.subjectType}:${row.subjectId}`,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    userId: row.userId,
    username: row.username,
    displayName: row.displayName,
    occurredAt: row.occurredAt,
    title: postTitle(row),
    headline: postHeadline(row),
    stats: postStats(row, unit),
    exercises: row.exerciseNames.slice(0, MAX_EXERCISE_CHIPS),
    moreExercises: Math.max(0, row.exerciseNames.length - MAX_EXERCISE_CHIPS),
    recordCount: row.recordCount,
    badgeIds: row.badgeIds,
    reactionCounts: row.reactionCounts,
    totalReactions: totalReactions(row.reactionCounts),
    myReaction: row.myReaction,
  }));
}

/**
 * Applies a tap optimistically: tapping your current reaction clears it,
 * tapping a different one replaces it. One reaction per person per post, so a
 * post cannot be spammed by a single friend.
 */
export function toggleReaction(post: FeedPost, reaction: ReactionId): FeedPost {
  const counts = { ...post.reactionCounts };
  const previous = post.myReaction;

  if (previous) counts[previous] = Math.max(0, (counts[previous] ?? 1) - 1);

  const next = previous === reaction ? null : reaction;
  if (next) counts[next] = (counts[next] ?? 0) + 1;

  return {
    ...post,
    reactionCounts: counts,
    totalReactions: totalReactions(counts),
    myReaction: next,
  };
}

/** "3h ago", "Yesterday", "Mar 4" — relative while it is still interesting. */
export function relativeTime(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diffMinutes = Math.floor((nowMs - then) / 60_000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
