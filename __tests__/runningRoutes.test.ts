import { attemptPlace, rankAttempts, type Attempt } from '../src/domain/running/routes';

const attempt = (id: string, movingSeconds: number, day: number): Attempt => ({
  activityId: id,
  performedAt: `2026-09-${String(day).padStart(2, '0')}T12:00:00Z`,
  name: null,
  movingSeconds,
  distanceM: 5000,
});

describe('comparing attempts at a route', () => {
  const ranked = rankAttempts([attempt('slow', 1700, 1), attempt('best', 1580, 5), attempt('mid', 1620, 9), attempt('tie', 1620, 12)]);

  it('puts the fastest first, with each one’s gap to it', () => {
    expect(ranked.map((a) => [a.activityId, a.rank, a.behindBest])).toEqual([
      ['best', 1, 0],
      ['mid', 2, 40],
      ['tie', 2, 40],
      ['slow', 4, 120],
    ]);
  });

  it('says where a run placed', () => {
    expect(attemptPlace(ranked, 'best')).toBe('Fastest of 4');
    expect(attemptPlace(ranked, 'mid')).toBe('2nd of 4');
    expect(attemptPlace(ranked, 'slow')).toBe('4th of 4');
    expect(attemptPlace(ranked, 'nope')).toBeNull();
    expect(attemptPlace(rankAttempts([attempt('only', 1600, 1)]), 'only')).toBe('First time on this route');
  });

  it('handles no attempts', () => {
    expect(rankAttempts([])).toEqual([]);
  });
});
