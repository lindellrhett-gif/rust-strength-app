import {
  REACTIONS,
  REACTION_IDS,
  activityLabel,
  buildFeed,
  isReactionId,
  postHeadline,
  postStats,
  postTitle,
  relativeTime,
  toggleReaction,
  totalReactions,
  type FeedRow,
} from '@/domain/feed';

function row(partial: Partial<FeedRow> = {}): FeedRow {
  return {
    subjectType: 'workout',
    subjectId: 's1',
    userId: 'u1',
    username: 'lifter',
    displayName: 'A Lifter',
    occurredAt: '2026-09-10T12:00:00.000Z',
    name: null,
    durationSeconds: 0,
    volume: 0,
    totalSets: 0,
    totalReps: 0,
    exerciseNames: [],
    recordCount: 0,
    activityKind: null,
    distance: null,
    distanceUnit: null,
    badgeIds: [],
    reactionCounts: {},
    myReaction: null,
    ...partial,
  };
}

describe('the reaction set', () => {
  it('has no duplicate ids', () => {
    expect(new Set(REACTION_IDS).size).toBe(REACTION_IDS.length);
  });

  it('uses drawn glyphs, never emoji', () => {
    const nonAscii = /[^\x20-\x7E]/;
    for (const r of REACTIONS) {
      expect(r.glyph).not.toMatch(nonAscii);
      expect(r.label).not.toMatch(nonAscii);
    }
  });

  it('recognises its own ids and rejects anything else', () => {
    expect(isReactionId('fire')).toBe(true);
    expect(isReactionId('thumbs-up')).toBe(false);
  });
});

describe('postTitle', () => {
  it('prefers the name the session was given', () => {
    expect(postTitle(row({ name: 'Push Day 1' }))).toBe('Push Day 1');
  });

  it('falls back to a plain default for an unnamed workout', () => {
    expect(postTitle(row())).toBe('Workout');
  });

  it('names an activity by its kind', () => {
    expect(postTitle(row({ subjectType: 'activity', activityKind: 'stairmaster' }))).toBe(
      'Stair master',
    );
  });

  it('ignores a name that is only whitespace', () => {
    expect(postTitle(row({ name: '   ' }))).toBe('Workout');
  });

  it('handles an activity kind the app does not recognise', () => {
    expect(activityLabel('parkour')).toBe('Activity');
    expect(activityLabel(null)).toBe('Activity');
  });
});

describe('postHeadline', () => {
  it('leads with personal records', () => {
    expect(postHeadline(row({ recordCount: 1 }))).toBe('New personal record');
    expect(postHeadline(row({ recordCount: 2 }))).toBe('Two personal records');
    expect(postHeadline(row({ recordCount: 4 }))).toBe('4 personal records — huge session');
  });

  it('calls out a big session when there were no records', () => {
    expect(postHeadline(row({ totalSets: 24 }))).toBe('Big volume day');
  });

  it('says nothing about an ordinary session', () => {
    expect(postHeadline(row({ totalSets: 9 }))).toBeNull();
  });

  it('shows distance for an activity that has one', () => {
    const post = row({ subjectType: 'activity', distance: 3.107, distanceUnit: 'mi' });
    expect(postHeadline(post)).toBe('3.11 mi');
  });

  it('says nothing for an activity logged without distance', () => {
    expect(postHeadline(row({ subjectType: 'activity' }))).toBeNull();
  });
});

describe('postStats', () => {
  it('reports time, volume, sets and reps for a workout', () => {
    const stats = postStats(
      row({ durationSeconds: 3_600, volume: 12_500, totalSets: 18, totalReps: 150 }),
      'lb',
    );
    expect(stats.map((s) => s.label)).toEqual(['time', 'lb moved', 'sets', 'reps']);
    expect(stats[1].value).toBe('12,500');
  });

  it('labels volume in the viewer’s own unit', () => {
    expect(postStats(row({ volume: 500 }), 'kg')[0].label).toBe('kg moved');
  });

  it('leaves out numbers a session does not have', () => {
    expect(postStats(row(), 'lb')).toHaveLength(0);
  });

  it('reports distance rather than volume for an activity', () => {
    const stats = postStats(
      row({ subjectType: 'activity', durationSeconds: 1_800, distance: 5, distanceUnit: 'km' }),
      'lb',
    );
    expect(stats.map((s) => s.label)).toEqual(['time', 'km']);
  });
});

describe('buildFeed', () => {
  it('gives each post a key unique across both kinds', () => {
    const posts = buildFeed(
      [row({ subjectId: 'x' }), row({ subjectType: 'activity', subjectId: 'x' })],
      'lb',
    );
    expect(posts[0].key).not.toBe(posts[1].key);
  });

  it('caps the exercise chips and counts the overflow', () => {
    const post = buildFeed(
      [row({ exerciseNames: ['Bench', 'Squat', 'Row', 'Curl', 'Dip', 'Press'] })],
      'lb',
    )[0];
    expect(post.exercises).toHaveLength(4);
    expect(post.moreExercises).toBe(2);
  });

  it('reports no overflow when everything fits', () => {
    const post = buildFeed([row({ exerciseNames: ['Bench', 'Squat'] })], 'lb')[0];
    expect(post.moreExercises).toBe(0);
  });

  it('carries the viewer’s own reaction through', () => {
    const post = buildFeed([row({ myReaction: 'fire', reactionCounts: { fire: 3 } })], 'lb')[0];
    expect(post.myReaction).toBe('fire');
    expect(post.totalReactions).toBe(3);
  });

  it('returns an empty feed for no rows', () => {
    expect(buildFeed([], 'lb')).toEqual([]);
  });

  it('carries the author’s awarded badges through to the card', () => {
    const post = buildFeed([row({ badgeIds: ['influencer'] })], 'lb')[0];
    expect(post.badgeIds).toEqual(['influencer']);
  });
});

describe('toggleReaction', () => {
  const base = buildFeed([row({ reactionCounts: { fire: 2, strong: 1 } })], 'lb')[0];

  it('adds a reaction when there was none', () => {
    const next = toggleReaction(base, 'fire');
    expect(next.myReaction).toBe('fire');
    expect(next.reactionCounts.fire).toBe(3);
  });

  it('clears the reaction when the same one is tapped again', () => {
    const on = toggleReaction(base, 'fire');
    const off = toggleReaction(on, 'fire');
    expect(off.myReaction).toBeNull();
    expect(off.reactionCounts.fire).toBe(2);
  });

  it('moves the count when a different reaction is picked', () => {
    const fire = toggleReaction(base, 'fire');
    const strong = toggleReaction(fire, 'strong');
    expect(strong.myReaction).toBe('strong');
    expect(strong.reactionCounts.fire).toBe(2);
    expect(strong.reactionCounts.strong).toBe(2);
  });

  it('keeps one person to one reaction, however many times they tap', () => {
    let post = base;
    for (const id of ['fire', 'strong', 'heavy', 'respect', 'fire'] as const) {
      post = toggleReaction(post, id);
    }
    const mine = REACTION_IDS.filter((id) => post.myReaction === id);
    expect(mine).toHaveLength(1);
    expect(post.totalReactions).toBe(4);
  });

  it('never drives a count below zero', () => {
    const empty = buildFeed([row({ myReaction: 'fire', reactionCounts: {} })], 'lb')[0];
    const cleared = toggleReaction(empty, 'fire');
    expect(cleared.reactionCounts.fire).toBe(0);
    expect(totalReactions(cleared.reactionCounts)).toBe(0);
  });

  it('does not mutate the post it was given', () => {
    const before = { ...base.reactionCounts };
    toggleReaction(base, 'heavy');
    expect(base.reactionCounts).toEqual(before);
    expect(base.myReaction).toBeNull();
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-09-10T12:00:00.000Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('describes the last hour in minutes', () => {
    expect(relativeTime(ago(30_000), now)).toBe('Just now');
    expect(relativeTime(ago(20 * 60_000), now)).toBe('20m ago');
  });

  it('describes today in hours', () => {
    expect(relativeTime(ago(5 * 3_600_000), now)).toBe('5h ago');
  });

  it('names yesterday', () => {
    expect(relativeTime(ago(30 * 3_600_000), now)).toBe('Yesterday');
  });

  it('counts days up to a week', () => {
    expect(relativeTime(ago(4 * 86_400_000), now)).toBe('4d ago');
  });

  it('falls back to a date beyond a week', () => {
    expect(relativeTime(ago(40 * 86_400_000), now)).toMatch(/\w{3} \d+/);
  });

  it('returns an empty string for an unparseable timestamp', () => {
    expect(relativeTime('not-a-date', now)).toBe('');
  });
});
