import { readFileSync } from 'node:fs';

import {
  LEADERBOARD_METRICS,
  METRIC_LABEL,
  convertVolume,
  formatMetric,
  metricNote,
  periodSince,
  rankLeaderboard,
  type LeaderboardPerson,
} from '../src/domain/leaderboard';

const TODAY = '2026-09-18';

const person = (over: Partial<LeaderboardPerson>): LeaderboardPerson => ({
  userId: over.username ?? 'u',
  username: 'u',
  displayName: null,
  unit: 'lb',
  isMe: false,
  totalVolume: 0,
  workoutSeconds: 0,
  activitySeconds: 0,
  workoutDates: [],
  ...over,
});

describe('leaderboard', () => {
  it('offers the five boards asked for', () => {
    expect([...LEADERBOARD_METRICS]).toEqual([
      'streak',
      'volume',
      'workoutTime',
      'consistency',
      'activityTime',
    ]);
    for (const m of LEADERBOARD_METRICS) expect(METRIC_LABEL[m].length).toBeGreaterThan(0);
  });

  it('ranks highest first', () => {
    const rows = rankLeaderboard(
      [
        person({ username: 'amy', workoutSeconds: 3600 }),
        person({ username: 'bo', workoutSeconds: 7200 }),
        person({ username: 'cy', workoutSeconds: 60 }),
      ],
      'workoutTime',
      TODAY,
      'lb',
    );
    expect(rows.map((r) => [r.rank, r.person.username])).toEqual([
      [1, 'bo'],
      [2, 'amy'],
      [3, 'cy'],
    ]);
  });

  it('gives ties the same rank and orders them by username', () => {
    const rows = rankLeaderboard(
      [
        person({ username: 'zed', activitySeconds: 100 }),
        person({ username: 'ann', activitySeconds: 100 }),
        person({ username: 'max', activitySeconds: 50 }),
      ],
      'activityTime',
      TODAY,
      'lb',
    );
    expect(rows.map((r) => [r.rank, r.person.username])).toEqual([
      [1, 'ann'],
      [1, 'zed'],
      [3, 'max'],
    ]);
  });

  it('compares volume in the viewer’s unit', () => {
    expect(convertVolume(1000, 'kg', 'lb')).toBeCloseTo(2204.62);
    expect(convertVolume(2204.62, 'lb', 'kg')).toBeCloseTo(1000);
    const rows = rankLeaderboard(
      [
        person({ username: 'pounds', unit: 'lb', totalVolume: 2000 }),
        person({ username: 'kilos', unit: 'kg', totalVolume: 1000 }),
      ],
      'volume',
      TODAY,
      'lb',
    );
    // 1000 kg is about 2205 lb, so it wins.
    expect(rows[0].person.username).toBe('kilos');
    expect(rows[0].value).toBe(2205);
  });

  it('counts current streaks from training days', () => {
    const rows = rankLeaderboard(
      [
        person({ username: 'on', workoutDates: ['2026-09-16', '2026-09-17', '2026-09-18'] }),
        person({ username: 'lapsed', workoutDates: ['2026-09-10', '2026-09-11'] }),
      ],
      'streak',
      TODAY,
      'lb',
    );
    expect(rows.map((r) => [r.person.username, r.value])).toEqual([
      ['on', 3],
      ['lapsed', 0],
    ]);
  });

  it('reports consistency as a percentage of the last 30 days', () => {
    // Every other day for the last 18 days: 9 training days.
    const dates = [18, 16, 14, 12, 10, 8, 6, 4, 2].map((d) => `2026-09-${String(d).padStart(2, '0')}`);
    const rows = rankLeaderboard(
      [person({ username: 'often', workoutDates: dates })],
      'consistency',
      TODAY,
      'lb',
    );
    expect(rows[0].value).toBe(30); // 9 of 30 days
  });

  it('formats each figure for its board', () => {
    expect(formatMetric(1, 'streak', 'lb')).toBe('1 day');
    expect(formatMetric(12, 'streak', 'lb')).toBe('12 days');
    expect(formatMetric(125_000, 'volume', 'kg')).toBe('125k kg');
    expect(formatMetric(87, 'consistency', 'lb')).toBe('87%');
    expect(formatMetric(0, 'workoutTime', 'lb')).toBe('0m');
    expect(formatMetric(5400, 'activityTime', 'lb')).toBe('1h 30m');
  });

  it('explains every board', () => {
    for (const m of LEADERBOARD_METRICS) {
      expect(metricNote(m, 'week').length).toBeGreaterThan(0);
    }
    expect(metricNote('streak', 'all')).toMatch(/Rest days are private/);
  });

  it('windows totals by period', () => {
    const now = Date.UTC(2026, 8, 18);
    expect(periodSince('all', now)).toBeNull();
    expect(periodSince('week', now)!.toISOString()).toBe('2026-09-11T00:00:00.000Z');
    expect(periodSince('month', now)!.toISOString()).toBe('2026-08-19T00:00:00.000Z');
  });
});

describe('rpc_friend_leaderboard', () => {
  const sql = readFileSync('supabase/migrations/0013_timed_sets_leaderboard.sql', 'utf8');
  const fn = sql.slice(sql.indexOf('create or replace function rpc_friend_leaderboard'));

  it('includes only the caller and accepted friends', () => {
    expect(fn).toMatch(/select auth\.uid\(\) as id/);
    expect(fn).toMatch(/f\.status = 'accepted'/);
    expect(fn).toMatch(/where auth\.uid\(\) is not null/);
  });

  it('is callable only by signed-in users', () => {
    expect(sql).toMatch(/revoke all on function rpc_friend_leaderboard\(timestamptz\) from public/);
    expect(sql).toMatch(/grant execute on function rpc_friend_leaderboard\(timestamptz\) to authenticated/);
  });
});
