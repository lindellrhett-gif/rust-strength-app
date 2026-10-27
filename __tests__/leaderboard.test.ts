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

const person = (over: Partial<LeaderboardPerson>): LeaderboardPerson => ({
  userId: over.username ?? 'u',
  username: 'u',
  displayName: null,
  unit: 'lb',
  isMe: false,
  totalVolume: 0,
  workoutSeconds: 0,
  activitySeconds: 0,
  currentStreak: 0,
  consistency: 0,
  runDistanceM: 0,
  steps: null,
  ...over,
});

describe('leaderboard', () => {
  it('offers the seven boards asked for', () => {
    expect([...LEADERBOARD_METRICS]).toEqual([
      'streak',
      'volume',
      'workoutTime',
      'consistency',
      'activityTime',
      'runDistance',
      'steps',
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
      'lb',
    );
    // 1000 kg is about 2205 lb, so it wins.
    expect(rows[0].person.username).toBe('kilos');
    expect(rows[0].value).toBe(2205);
  });

  it('ranks streak and consistency on the figures given', () => {
    const people = [
      person({ username: 'steady', currentStreak: 4, consistency: 100 }),
      person({ username: 'keen', currentStreak: 9, consistency: 60 }),
    ];
    expect(rankLeaderboard(people, 'streak', 'lb')[0].person.username).toBe('keen');
    expect(rankLeaderboard(people, 'consistency', 'lb')[0].person.username).toBe('steady');
  });

  it('formats each figure for its board', () => {
    expect(formatMetric(1, 'streak', 'lb')).toBe('1 day');
    expect(formatMetric(12, 'streak', 'lb')).toBe('12 days');
    expect(formatMetric(125_000, 'volume', 'kg')).toBe('125k kg');
    expect(formatMetric(87, 'consistency', 'lb')).toBe('87%');
    expect(formatMetric(0, 'workoutTime', 'lb')).toBe('0m');
    expect(formatMetric(5400, 'activityTime', 'lb')).toBe('1h 30m');
  });

  it('explains how rest days count', () => {
    for (const m of LEADERBOARD_METRICS) {
      expect(metricNote(m, 'week').length).toBeGreaterThan(0);
    }
    expect(metricNote('streak', 'all')).toMatch(/rest day keeps a streak going but does not add/);
    expect(metricNote('consistency', 'all')).toMatch(/rest day/);
  });

  it('windows totals by period', () => {
    const now = Date.UTC(2026, 8, 18);
    expect(periodSince('all', now)).toBeNull();
    expect(periodSince('week', now)!.toISOString()).toBe('2026-09-11T00:00:00.000Z');
    expect(periodSince('month', now)!.toISOString()).toBe('2026-08-19T00:00:00.000Z');
  });
});

describe('server-side friend figures (migration 0014)', () => {
  const sql = readFileSync('supabase/migrations/0014_streaks_friend_time.sql', 'utf8');
  const section = (start: string) => {
    const from = sql.indexOf(start);
    const next = sql.indexOf('\n-- ----', from + 1);
    return sql.slice(from, next === -1 ? undefined : next);
  };

  it('sums a friend’s workout time over workouts alone, not once per set', () => {
    const stats = section('create function rpc_friend_stats');
    const timeBlock = stats.slice(
      stats.indexOf('-- Workouts on their own'),
      stats.indexOf(') w on true'),
    );
    expect(timeBlock).toMatch(/extract\(epoch from \(wo\.ended_at - wo\.started_at\)\)/);
    expect(timeBlock).not.toMatch(/join sets/);
  });

  it('keeps rest days on the server and returns only the numbers', () => {
    for (const fn of ['create function rpc_friend_stats', 'create function rpc_friend_leaderboard']) {
      const body = section(fn);
      expect(body).toMatch(/streak_stats\(p\.user_id, p_today\)/);
      expect(body).not.toMatch(/rest_date/);
    }
    expect(sql).toMatch(
      /revoke all on function streak_stats\(uuid, date\) from public, anon, authenticated/,
    );
  });

  it('counts only training days in a run, and ignores future rest days', () => {
    const fn = section('create or replace function streak_stats');
    expect(fn).toMatch(/count\(\*\) filter \(where trained\)/);
    expect(fn).toMatch(/where d <= p_today/);
    expect(fn).toMatch(/c\.d > p_today - 30\) \/ 30/);
  });

  it('keeps older app builds working', () => {
    expect(sql).toMatch(/rpc_friend_stats\(target uuid, p_today date default current_date\)/);
  });

  it('includes only the caller and accepted friends on the leaderboard', () => {
    const fn = section('create function rpc_friend_leaderboard');
    expect(fn).toMatch(/select auth\.uid\(\) as id/);
    expect(fn).toMatch(/f\.status = 'accepted'/);
    expect(fn).toMatch(/where auth\.uid\(\) is not null/);
    expect(sql).toMatch(
      /grant execute on function rpc_friend_leaderboard\(timestamptz, date\) to authenticated/,
    );
  });
});

describe('run distance and steps boards', () => {
  it('ranks run distance, shown in miles or kilometres by the viewer’s unit', () => {
    const rows = rankLeaderboard(
      [person({ username: 'a', runDistanceM: 5000 }), person({ username: 'b', runDistanceM: 21097.5 })],
      'runDistance',
      'lb',
    );
    expect(rows.map((r) => r.person.username)).toEqual(['b', 'a']);
    expect(formatMetric(rows[0].value, 'runDistance', 'lb')).toBe('13.1 mi');
    expect(formatMetric(rows[0].value, 'runDistance', 'kg')).toBe('21.1 km');
    expect(formatMetric(500_000, 'runDistance', 'kg')).toBe('500 km');
  });

  it('leaves people who don’t share their steps off the steps board', () => {
    const rows = rankLeaderboard(
      [person({ username: 'a', steps: 42_000 }), person({ username: 'b', steps: null }), person({ username: 'c', steps: 0 })],
      'steps',
      'lb',
    );
    expect(rows.map((r) => r.person.username)).toEqual(['a', 'c']);
    expect(formatMetric(42_000, 'steps', 'lb')).toBe('42k');
    expect(metricNote('steps', 'week')).toMatch(/share their daily steps/);
  });
});
