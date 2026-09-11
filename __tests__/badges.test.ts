import {
  ALL_BADGES,
  GRANTED_BADGES,
  LEVEL_BADGES,
  badgeById,
  badgeTiersAreValid,
  earnedBadges,
  evaluateBadges,
  nextBadge,
} from '@/domain/badges';
import { MAX_LEVEL } from '@/domain/xp';

describe('the badge catalogue', () => {
  it('has no duplicate ids', () => {
    const ids = ALL_BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tints every badge with a real trophy tier', () => {
    expect(badgeTiersAreValid()).toBe(true);
  });

  it('gives every level badge an unlock level, in ascending order', () => {
    const levels = LEVEL_BADGES.map((b) => b.level!);
    expect(levels.every((l) => Number.isInteger(l) && l > 0)).toBe(true);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });

  it('tops out at the level cap', () => {
    expect(LEVEL_BADGES[LEVEL_BADGES.length - 1].level).toBe(MAX_LEVEL);
  });

  it('uses drawn glyphs, never emoji', () => {
    // Matches anything outside the plain ASCII range, which is what an emoji
    // slipping into a name or glyph key would look like.
    const nonAscii = /[^\x20-\x7E]/;
    for (const b of ALL_BADGES) {
      expect(b.glyph).not.toMatch(nonAscii);
      expect(b.name).not.toMatch(nonAscii);
    }
  });

  it('looks a badge up by id, and returns null for an unknown one', () => {
    expect(badgeById('influencer')?.name).toBe('Influencer');
    expect(badgeById('not-a-badge')).toBeNull();
  });

  it('offers exactly the two hand-awarded badges', () => {
    expect(GRANTED_BADGES.map((b) => b.id).sort()).toEqual(['beta-tester', 'influencer']);
  });
});

describe('evaluateBadges', () => {
  it('unlocks nothing at level 1', () => {
    expect(earnedBadges(evaluateBadges(1, []))).toHaveLength(0);
  });

  it('unlocks every level badge at or below the current level', () => {
    const earned = earnedBadges(evaluateBadges(30, []));
    expect(earned.map((b) => b.id)).toEqual(['level-5', 'level-10', 'level-20', 'level-30']);
  });

  it('counts down the levels still to climb', () => {
    const list = evaluateBadges(7, []);
    const next = list.find((b) => b.id === 'level-10')!;
    expect(next.earned).toBe(false);
    expect(next.levelsAway).toBe(3);
  });

  it('hides an unawarded granted badge rather than showing it locked', () => {
    const list = evaluateBadges(50, []);
    expect(list.some((b) => b.id === 'influencer')).toBe(false);
  });

  it('shows a granted badge once it is actually held, ahead of level badges', () => {
    const list = evaluateBadges(50, ['influencer']);
    expect(list[0].id).toBe('influencer');
    expect(list[0].earned).toBe(true);
  });

  it('ignores an id the app does not know about', () => {
    const list = evaluateBadges(10, ['influencer', 'mystery-badge']);
    expect(list.some((b) => b.id === 'mystery-badge')).toBe(false);
    expect(list.some((b) => b.id === 'influencer')).toBe(true);
  });

  it('awards every badge at the cap', () => {
    const earned = earnedBadges(evaluateBadges(MAX_LEVEL, ['influencer', 'beta-tester']));
    expect(earned).toHaveLength(ALL_BADGES.length);
  });
});

describe('nextBadge', () => {
  it('returns the nearest level badge still to come', () => {
    expect(nextBadge(evaluateBadges(12, []))?.id).toBe('level-20');
  });

  it('returns null once every level badge is earned', () => {
    expect(nextBadge(evaluateBadges(MAX_LEVEL, []))).toBeNull();
  });

  it('never suggests a granted badge as something to work toward', () => {
    const next = nextBadge(evaluateBadges(1, []));
    expect(next?.kind).toBe('level');
  });
});
