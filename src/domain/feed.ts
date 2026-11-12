/**
 * The friend feed: shaping server rows into the posts the Friends tab shows.
 *
 * A post is a *summary*, never a set-by-set replay. Friends see what someone
 * trained and how much work it was; they do not get a window into every rep.
 * That line is drawn here and again in SQL, so loosening one alone changes
 * nothing.
 */

import { formatClock, formatDurationShort } from './duration';
import { convertVolume } from './leaderboard';
import type { LatLon } from './running/geo';
import { decodePolyline } from './running/polyline';
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
  /**
   * A shared run's outline as an encoded polyline: already trimmed and
   * simplified on the server. Null unless the runner shared the map, or
   * it's your own run.
   */
  routePreview?: string | null;
  /** "trophy:tier" keys the author shows by their name. */
  featuredTrophies?: string[];
  /** The unit the author logs in, which their volume is stored in. Null until migration 0035. */
  authorUnit?: 'lb' | 'kg' | null;
}

/** The kind of session a post's graphic is coloured for. */
export type PosterTone = 'record' | 'lift' | 'run' | 'activity';

/** The big graphic at the heart of a post, in words and numbers. */
export interface PostPoster {
  tone: PosterTone;
  /** The small line at the top, e.g. "Two personal records". */
  eyebrow: string | null;
  title: string;
  /** The one big number. */
  hero: string;
  /** The rest, smaller: "1h 5m", "24 sets". */
  details: string[];
  /** The short version for the grid on a friend's profile. */
  tile: { value: string };
}

export interface FeedPost {
  key: string;
  subjectType: FeedSubjectType;
  subjectId: string;
  userId: string;
  username: string;
  displayName: string | null;
  occurredAt: string;
  /** What the post is called: the preset name, the activity, or a fallback. */
  title: string;
  poster: PostPoster;
  /** Up to four exercise names, for the line under the post. */
  exercises: string[];
  /** How many more exercises that line leaves out. */
  moreExercises: number;
  recordCount: number;
  badgeIds: string[];
  reactionCounts: Partial<Record<ReactionId, number>>;
  totalReactions: number;
  myReaction: ReactionId | null;
  /** A shared run's outline, or null. */
  route: LatLon[] | null;
  /** "trophy:tier" keys the author shows by their name. */
  featuredTrophies: string[];
}

const MAX_EXERCISES_SHOWN = 4;

/** The outline of a shared run, or null when there is none or it can't be read. */
export function routeFrom(encoded: string | null | undefined): LatLon[] | null {
  if (!encoded) return null;
  try {
    const points = decodePolyline(encoded);
    return points.length >= 2 ? points : null;
  } catch {
    return null;
  }
}

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
 * The small line on a workout's graphic. Personal records outrank everything,
 * because that is the thing a friend would actually want to say something about.
 */
export function postHeadline(row: FeedRow): string | null {
  if (row.subjectType === 'workout') {
    if (row.recordCount >= 3) return `${row.recordCount} personal records`;
    if (row.recordCount === 2) return 'Two personal records';
    if (row.recordCount === 1) return 'New personal record';
    if (row.totalSets >= 20) return 'Big volume day';
  }
  return null;
}

const plural = (n: number, one: string) => `${comma(n)} ${one}${n === 1 ? '' : 's'}`;

/** 14,120 as "14.1k", for a tile too small for the whole number. */
function shortNumber(n: number): string {
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (n >= 1_000_000) return `${trim((n / 1_000_000).toFixed(1))}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${trim((n / 1_000).toFixed(1))}k`;
  return comma(n);
}

/**
 * What a post's graphic says. Only what a summary already shares: the session's
 * name, time, total weight, sets and reps, records, distance and pace.
 */
export function postPoster(row: FeedRow, unit: 'lb' | 'kg'): PostPoster {
  const title = postTitle(row);
  const time = row.durationSeconds > 0 ? formatDurationShort(row.durationSeconds) : null;

  if (row.subjectType === 'workout') {
    // Stored in the author's unit; shown in the viewer's.
    const volume = Math.round(convertVolume(row.volume, row.authorUnit ?? unit, unit));
    const reps = row.totalReps > 0 ? plural(row.totalReps, 'rep') : null;
    const sets = row.totalSets > 0 ? plural(row.totalSets, 'set') : null;
    const hero = volume > 0 ? `${comma(volume)} ${unit}` : (reps ?? time ?? '0 sets');
    return {
      tone: row.recordCount > 0 ? 'record' : 'lift',
      eyebrow: postHeadline(row),
      title,
      hero,
      details: [time, sets, reps].filter((d): d is string => d != null && d !== hero),
      tile: {
        value:
          row.recordCount > 0
            ? `${row.recordCount} PR${row.recordCount === 1 ? '' : 's'}`
            : volume > 0
              ? shortNumber(volume)
              : hero,
      },
    };
  }

  const isRun = row.activityKind === 'run';
  const hasDistance = row.distance != null && row.distance > 0 && !!row.distanceUnit;
  const distance = hasDistance ? `${Number(row.distance!.toFixed(2))} ${row.distanceUnit}` : null;
  const hero = distance ?? time ?? '0m';
  // Pace is what a runner looks at first.
  const pace =
    isRun && hasDistance && row.durationSeconds > 0 && (row.distanceUnit === 'mi' || row.distanceUnit === 'km')
      ? `${formatClock(Math.round(row.durationSeconds / row.distance!))} /${row.distanceUnit}`
      : null;
  return {
    tone: isRun ? 'run' : 'activity',
    eyebrow: null,
    title,
    hero,
    details: [time, pace].filter((d): d is string => d != null && d !== hero),
    tile: { value: hero },
  };
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
    poster: postPoster(row, unit),
    exercises: row.exerciseNames.slice(0, MAX_EXERCISES_SHOWN),
    moreExercises: Math.max(0, row.exerciseNames.length - MAX_EXERCISES_SHOWN),
    recordCount: row.recordCount,
    badgeIds: row.badgeIds,
    reactionCounts: row.reactionCounts,
    totalReactions: totalReactions(row.reactionCounts),
    myReaction: row.myReaction,
    route: routeFrom(row.routePreview),
    featuredTrophies: row.featuredTrophies ?? [],
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
