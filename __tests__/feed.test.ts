import { encodePolyline } from '@/domain/running/polyline';
import { outlinePath } from '@/domain/running/display';
import {
  REACTIONS,
  REACTION_IDS,
  activityLabel,
  buildFeed,
  isReactionId,
  postHeadline,
  postPoster,
  postTitle,
  relativeTime,
  routeFrom,
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
    expect(postHeadline(row({ recordCount: 4 }))).toBe('4 personal records');
  });

  it('calls out a big session when there were no records', () => {
    expect(postHeadline(row({ totalSets: 24 }))).toBe('Big volume day');
  });

  it('says nothing about an ordinary session', () => {
    expect(postHeadline(row({ totalSets: 9 }))).toBeNull();
  });

  it('leaves an activity’s distance to the big number', () => {
    const post = row({ subjectType: 'activity', distance: 3.107, distanceUnit: 'mi' });
    expect(postHeadline(post)).toBeNull();
  });

  it('says nothing for an activity logged without distance', () => {
    expect(postHeadline(row({ subjectType: 'activity' }))).toBeNull();
  });
});

describe('postPoster', () => {
  it('makes a workout’s total weight the big number', () => {
    const poster = postPoster(
      row({ name: 'Push day', durationSeconds: 3_900, volume: 18_450, totalSets: 18, totalReps: 150 }),
      'lb',
    );
    expect(poster.tone).toBe('lift');
    expect(poster.title).toBe('Push day');
    expect(poster.hero).toBe('18,450 lb');
    expect(poster.details).toEqual(['1h 5m', '18 sets', '150 reps']);
    expect(poster.tile.value).toBe('18.4k');
  });

  it('labels volume in the viewer’s own unit', () => {
    expect(postPoster(row({ volume: 500 }), 'kg').hero).toBe('500 kg');
  });

  it('converts a volume logged in another unit', () => {
    expect(postPoster(row({ volume: 1000, authorUnit: 'kg' }), 'lb').hero).toBe('2,205 lb');
    expect(postPoster(row({ volume: 2205, authorUnit: 'lb' }), 'kg').hero).toBe('1,000 kg');
    expect(postPoster(row({ volume: 1000, authorUnit: 'kg' }), 'kg').hero).toBe('1,000 kg');
  });

  it('takes the viewer’s unit when the author’s isn’t known', () => {
    expect(postPoster(row({ volume: 1000, authorUnit: null }), 'kg').hero).toBe('1,000 kg');
  });

  it('turns gold for a personal record and says so', () => {
    const poster = postPoster(row({ volume: 1000, recordCount: 2 }), 'lb');
    expect(poster.tone).toBe('record');
    expect(poster.eyebrow).toBe('Two personal records');
    expect(poster.tile.value).toBe('2 PRs');
  });

  it('says one record in the singular', () => {
    expect(postPoster(row({ recordCount: 1 }), 'lb').tile.value).toBe('1 PR');
  });

  it('falls back to reps, then time, when no weight was lifted', () => {
    const reps = postPoster(row({ totalReps: 40, totalSets: 4, durationSeconds: 600 }), 'lb');
    expect(reps.hero).toBe('40 reps');
    expect(reps.details).toEqual(['10m', '4 sets']);
    const time = postPoster(row({ durationSeconds: 600 }), 'lb');
    expect(time.hero).toBe('10m');
    expect(time.details).toEqual([]);
  });

  it('still has something to say about an empty session', () => {
    expect(postPoster(row(), 'lb').hero).toBe('0 sets');
  });

  it('uses singular words for one set and one rep', () => {
    expect(postPoster(row({ volume: 100, totalSets: 1, totalReps: 1 }), 'lb').details).toEqual(['1 set', '1 rep']);
  });

  it('shortens big numbers for the grid', () => {
    const tile = (volume: number) => postPoster(row({ volume }), 'lb').tile.value;
    expect(tile(950)).toBe('950');
    expect(tile(14_120)).toBe('14.1k');
    expect(tile(2_000)).toBe('2k');
    expect(tile(123_456)).toBe('123k');
    expect(tile(1_250_000)).toBe('1.3M');
  });

  it('gives an activity with no distance its time', () => {
    const poster = postPoster(row({ subjectType: 'activity', activityKind: 'yoga', durationSeconds: 2_700 }), 'lb');
    expect(poster.tone).toBe('activity');
    expect(poster.title).toBe('Yoga');
    expect(poster.hero).toBe('45m');
    expect(poster.details).toEqual([]);
  });

  it('gives an activity with a distance its distance', () => {
    const poster = postPoster(
      row({ subjectType: 'activity', durationSeconds: 1_800, distance: 5, distanceUnit: 'km' }),
      'lb',
    );
    expect(poster.hero).toBe('5 km');
    expect(poster.details).toEqual(['30m']);
  });

  it('never mentions a single set or its weight', () => {
    const poster = postPoster(row({ volume: 1000, totalSets: 3, totalReps: 10, recordCount: 1 }), 'lb');
    expect(JSON.stringify(poster)).not.toMatch(/rpe|×/i);
  });
});

describe('runs in the feed', () => {
  it('shows a run’s pace next to its distance', () => {
    const poster = postPoster(
      row({ subjectType: 'activity', activityKind: 'run', durationSeconds: 1500, distance: 3.1, distanceUnit: 'mi' }),
      'lb',
    );
    expect(poster.tone).toBe('run');
    expect(poster.hero).toBe('3.1 mi');
    expect(poster.details).toContain('8:04 /mi');
  });

  it('doesn’t give a pace to activities that aren’t runs', () => {
    const poster = postPoster(
      row({ subjectType: 'activity', activityKind: 'cycle', durationSeconds: 3600, distance: 20, distanceUnit: 'mi' }),
      'lb',
    );
    expect(poster.details.some((d) => d.includes('/'))).toBe(false);
  });

  it('carries a shared map’s outline, and nothing when the map isn’t shared', () => {
    const outline = [
      { lat: 47.92, lon: -97.03 },
      { lat: 47.925, lon: -97.025 },
      { lat: 47.93, lon: -97.03 },
    ];
    const [shared, unshared] = buildFeed(
      [
        row({ subjectId: 'r1', subjectType: 'activity', activityKind: 'run', routePreview: encodePolyline(outline) }),
        row({ subjectId: 'r2', subjectType: 'activity', activityKind: 'run', routePreview: null }),
      ],
      'lb',
    );
    expect(shared.route).toHaveLength(3);
    expect(shared.route![1].lat).toBeCloseTo(47.925, 5);
    expect(unshared.route).toBeNull();
  });

  it('ignores an outline it can’t read', () => {
    expect(routeFrom('_')).toBeNull();
    expect(routeFrom('')).toBeNull();
  });

  it('draws the outline in its true shape, filling the box', () => {
    const square = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.01 },
      { lat: 0.01, lon: 0.01 },
    ];
    const path = outlinePath(square, 200, 100, 10)!;
    // A square at the equator in a wide box: as tall as the box allows, centred across.
    expect(path).toBe('M60.0,90.0L140.0,90.0L140.0,10.0');
    expect(outlinePath(square.slice(0, 1), 200, 100)).toBeNull();
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
