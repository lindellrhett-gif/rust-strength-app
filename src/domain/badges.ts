/**
 * Badges — the things a level actually unlocks, plus the handful that can only
 * be given out by hand.
 *
 * Two kinds, and the difference matters for security as much as for design:
 *
 *   * `level` badges are derived from XP, like trophies. Nothing is stored, so
 *     they cannot be forged and cannot go stale.
 *   * `granted` badges (Influencer, Beta Tester) are awarded by the operator
 *     and read from `profile_badges`. That table has no insert policy for
 *     signed-in users at all — only the service role can write it — because a
 *     badge a user can award themselves is not a badge.
 *
 * Both kinds render through the same hexagon medal as the trophies, so the
 * whole set reads as one family.
 */

import { TIERS, type Tier, type TrophyGlyph } from './achievements';
import { MAX_LEVEL } from './xp';

export type BadgeKind = 'level' | 'granted';

export interface BadgeDef {
  id: string;
  name: string;
  /** Shown under the name, and in the locked state as the unlock condition. */
  description: string;
  glyph: TrophyGlyph;
  kind: BadgeKind;
  /** Tint, borrowed from the trophy tier palette. */
  tier: Tier;
  /** Level at which a `level` badge unlocks. Undefined for granted badges. */
  level?: number;
}

/**
 * Nine level badges against the nine trophy tiers, so the two systems share a
 * visual ladder. The gaps widen with the XP curve: the first four arrive in the
 * first couple of months, the last one is a genuine long haul.
 */
export const LEVEL_BADGES: BadgeDef[] = [
  {
    id: 'level-5',
    name: 'Off the Mark',
    description: 'Reach level 5',
    glyph: 'bolt',
    kind: 'level',
    tier: 'wood',
    level: 5,
  },
  {
    id: 'level-10',
    name: 'Showing Up',
    description: 'Reach level 10',
    glyph: 'calendar',
    kind: 'level',
    tier: 'stone',
    level: 10,
  },
  {
    id: 'level-20',
    name: 'Committed',
    description: 'Reach level 20',
    glyph: 'flame',
    kind: 'level',
    tier: 'silver',
    level: 20,
  },
  {
    id: 'level-30',
    name: 'Iron Habit',
    description: 'Reach level 30',
    glyph: 'stack',
    kind: 'level',
    tier: 'gold',
    level: 30,
  },
  {
    id: 'level-40',
    name: 'Heavy Hitter',
    description: 'Reach level 40',
    glyph: 'plate',
    kind: 'level',
    tier: 'platinum',
    level: 40,
  },
  {
    id: 'level-50',
    name: 'Relentless',
    description: 'Reach level 50',
    glyph: 'shield',
    kind: 'level',
    tier: 'diamond',
    level: 50,
  },
  {
    id: 'level-65',
    name: 'Built',
    description: 'Reach level 65',
    glyph: 'arm',
    kind: 'level',
    tier: 'emerald',
    level: 65,
  },
  {
    id: 'level-80',
    name: 'Titan',
    description: 'Reach level 80',
    glyph: 'body',
    kind: 'level',
    tier: 'ruby',
    level: 80,
  },
  {
    id: 'level-100',
    name: 'Apex',
    description: `Reach level ${MAX_LEVEL}`,
    glyph: 'crown',
    kind: 'level',
    tier: 'legend',
    level: MAX_LEVEL,
  },
];

/**
 * Badges awarded by hand. The ids are the values stored in `profile_badges`;
 * an id that is not in this list is ignored rather than rendered as a blank,
 * so adding a badge server-side before the app ships it is harmless.
 */
export const GRANTED_BADGES: BadgeDef[] = [
  {
    id: 'influencer',
    name: 'Influencer',
    description: 'Given to creators who help people find the app',
    glyph: 'star',
    kind: 'granted',
    tier: 'legend',
  },
  {
    id: 'beta-tester',
    name: 'Beta Tester',
    description: 'Given to the people who tested before launch',
    glyph: 'flask',
    kind: 'granted',
    tier: 'emerald',
  },
];

export const ALL_BADGES: BadgeDef[] = [...LEVEL_BADGES, ...GRANTED_BADGES];

export function badgeById(id: string): BadgeDef | null {
  return ALL_BADGES.find((b) => b.id === id) ?? null;
}

export interface EarnedBadge extends BadgeDef {
  earned: boolean;
  /** Levels still to climb before a level badge unlocks; 0 once earned. */
  levelsAway: number;
}

/**
 * The full shelf, earned state resolved.
 *
 * Level badges are decided by `level`. Granted badges only appear once they are
 * actually held: an un-awarded Influencer badge is hidden rather than shown
 * locked, because listing it would read as something you can grind for.
 */
export function evaluateBadges(level: number, grantedIds: string[]): EarnedBadge[] {
  const held = new Set(grantedIds);

  const levelBadges = LEVEL_BADGES.map((b) => {
    const required = b.level ?? MAX_LEVEL;
    return {
      ...b,
      earned: level >= required,
      levelsAway: Math.max(0, required - level),
    };
  });

  const granted = GRANTED_BADGES.filter((b) => held.has(b.id)).map((b) => ({
    ...b,
    earned: true,
    levelsAway: 0,
  }));

  // Awarded badges lead — they are the rarest thing on the shelf.
  return [...granted, ...levelBadges];
}

export function earnedBadges(list: EarnedBadge[]): EarnedBadge[] {
  return list.filter((b) => b.earned);
}

/** The next level badge still to come, for the "what's next" line. */
export function nextBadge(list: EarnedBadge[]): EarnedBadge | null {
  return (
    list
      .filter((b) => !b.earned && b.kind === 'level')
      .sort((a, b) => a.levelsAway - b.levelsAway)[0] ?? null
  );
}

/** Sanity guard: every badge tint must be a real trophy tier. */
export function badgeTiersAreValid(): boolean {
  return ALL_BADGES.every((b) => (TIERS as readonly string[]).includes(b.tier));
}
