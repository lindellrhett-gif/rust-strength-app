import {
  forLoad,
  monthlyTotals,
  runRecords,
  toHistoryRun,
  weekGoalProgress,
  weeklyTotals,
  type HistoryRow,
  type HistoryRun,
} from '../src/domain/running/history';

/** Treats the timestamp's date as the local date, so tests don't depend on the machine's time zone. */
const localDate = (iso: string) => iso.slice(0, 10);

const row = (overrides: Partial<HistoryRow> = {}): HistoryRow => ({
  id: 'a1',
  name: 'Morning run',
  performed_at: '2026-10-05T13:00:00Z',
  distance: 3.11,
  distance_unit: 'mi',
  duration_seconds: 1500,
  runs: {
    distance_m: 5005,
    moving_seconds: 1490,
    source: 'gps',
    effort: 6,
    run_best_efforts: [
      { effort_key: 'mile', seconds: 460 },
      { effort_key: '5k', seconds: 1480 },
      { effort_key: 'bogus', seconds: 1 },
    ],
  },
  ...overrides,
});

const run = (date: string, distanceM: number, extra: Partial<HistoryRun> = {}): HistoryRun => ({
  id: `${date}-${distanceM}`,
  name: 'Run',
  date,
  performedAt: `${date}T12:00:00Z`,
  distanceM,
  movingSeconds: distanceM / 3,
  effort: null,
  detailed: true,
  source: 'gps',
  efforts: {},
  ...extra,
});

describe('reading runs into one history', () => {
  it('uses the recorded detail when there is one', () => {
    const r = toHistoryRun(row(), localDate)!;
    expect(r).toMatchObject({ distanceM: 5005, movingSeconds: 1490, effort: 6, detailed: true, date: '2026-10-05' });
    expect(r.efforts).toEqual({ mile: 460, '5k': 1480 });
  });

  it('still counts a run logged by hand before running existed', () => {
    const r = toHistoryRun(row({ runs: null, distance: 2, distance_unit: 'mi', duration_seconds: 1200 }), localDate)!;
    expect(r.distanceM).toBeCloseTo(3218.69, 1);
    expect(r).toMatchObject({ movingSeconds: 1200, detailed: false, source: null, efforts: {} });
  });

  it('reads kilometres too, and names an untitled run', () => {
    const r = toHistoryRun(row({ runs: null, distance: 5, distance_unit: 'km', name: ' ' }), localDate)!;
    expect(r.distanceM).toBe(5000);
    expect(r.name).toBe('Run');
  });

  it('leaves out a run with no distance at all', () => {
    expect(toHistoryRun(row({ runs: null, distance: null, distance_unit: null }), localDate)).toBeNull();
  });
});

describe('weekly and monthly distance', () => {
  // Wednesday 7 October 2026; the week began on Sunday the 4th.
  const today = '2026-10-07';

  it('totals each Sunday-to-Saturday week, oldest first, this week last', () => {
    const weeks = weeklyTotals(
      [run('2026-10-04', 5000), run('2026-10-07', 3000), run('2026-10-03', 8000), run('2026-09-20', 10000)],
      today,
      4,
    );
    expect(weeks.map((w) => w.period)).toEqual(['2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04']);
    expect(weeks.map((w) => w.distanceM)).toEqual([0, 10000, 8000, 8000]);
    expect(weeks[3].runs).toBe(2);
  });

  it('ignores runs in the future and before the window', () => {
    const weeks = weeklyTotals([run('2026-10-10', 5000), run('2025-01-01', 5000)], today, 4);
    expect(weeks.every((w) => w.distanceM === 0)).toBe(true);
  });

  it('totals months across a new year', () => {
    const months = monthlyTotals([run('2025-11-30', 4000), run('2026-01-02', 6000)], '2026-01-15', 3);
    expect(months).toEqual([
      { period: '2025-11', distanceM: 4000, runs: 1 },
      { period: '2025-12', distanceM: 0, runs: 0 },
      { period: '2026-01', distanceM: 6000, runs: 1 },
    ]);
  });
});

describe('the weekly goal', () => {
  const today = '2026-10-07';

  it('measures this week against the goal', () => {
    const p = weekGoalProgress([run('2026-10-05', 8000), run('2026-10-02', 9000)], today, 20000)!;
    expect(p).toEqual({ distanceM: 8000, goalM: 20000, fraction: 0.4, met: false });
  });

  it('caps at a full bar once the goal is beaten', () => {
    const p = weekGoalProgress([run('2026-10-05', 25000)], today, 20000)!;
    expect(p.fraction).toBe(1);
    expect(p.met).toBe(true);
  });

  it('has nothing to show without a goal', () => {
    expect(weekGoalProgress([run('2026-10-05', 8000)], today, null)).toBeNull();
  });
});

describe('personal records', () => {
  it('finds the fastest time per distance and the longest run', () => {
    const quick = run('2026-09-01', 5100, { efforts: { mile: 420, '5k': 1450 } });
    const long = run('2026-09-10', 21500, { efforts: { mile: 470, '5k': 1500, '10k': 3100, half: 6900 } });
    const records = runRecords([quick, long]);
    expect(records.efforts.mile).toEqual({ seconds: 420, run: quick });
    expect(records.efforts.half?.run).toBe(long);
    expect(records.efforts.marathon).toBeUndefined();
    expect(records.longest).toBe(long);
  });

  it('has none before the first run', () => {
    expect(runRecords([])).toEqual({ efforts: {}, longest: null });
  });

  it('feeds the running-load summary', () => {
    expect(forLoad([run('2026-10-05', 5000, { effort: 8 })])).toEqual([
      { date: '2026-10-05', distanceM: 5000, movingSeconds: 5000 / 3, effort: 8 },
    ]);
  });
});
