import {
  PROGRESS_METRICS,
  buildChartGeometry,
  buildProgressSeries,
  nearestIndex,
  niceTicks,
  progressSummary,
  shortDate,
  type ChartPadding,
  type ProgressSet,
} from '@/domain/progress';

const PADDING: ChartPadding = { top: 10, right: 10, bottom: 20, left: 10 };

function set(date: string, weight: number, reps: number, e1rm = weight * (1 + reps / 30)): ProgressSet {
  return { date, weight, reps, e1rm };
}

describe('buildProgressSeries', () => {
  it('returns an empty series for no sets', () => {
    const s = buildProgressSeries([], 'e1rm');
    expect(s.points).toEqual([]);
    expect(s.latest).toBeNull();
    expect(s.bestIndex).toBe(-1);
  });

  it('collapses a day of sets into one point', () => {
    const s = buildProgressSeries(
      [set('2026-03-01', 185, 5), set('2026-03-01', 185, 4), set('2026-03-01', 195, 3)],
      'e1rm',
    );
    expect(s.points).toHaveLength(1);
    expect(s.points[0].sets).toBe(3);
  });

  it('orders points oldest first regardless of input order', () => {
    const s = buildProgressSeries(
      [set('2026-03-10', 200, 5), set('2026-03-01', 185, 5), set('2026-03-05', 190, 5)],
      'topSet',
    );
    expect(s.points.map((p) => p.date)).toEqual(['2026-03-01', '2026-03-05', '2026-03-10']);
  });

  it('takes the heaviest set of the day for the top-set metric', () => {
    const s = buildProgressSeries(
      [set('2026-03-01', 135, 10), set('2026-03-01', 225, 3)],
      'topSet',
    );
    expect(s.points[0].value).toBe(225);
    expect(s.points[0].topReps).toBe(3);
  });

  it('sums the day for the volume metric', () => {
    const s = buildProgressSeries(
      [set('2026-03-01', 100, 10), set('2026-03-01', 100, 5)],
      'volume',
    );
    expect(s.points[0].value).toBe(1500);
  });

  it('takes the best estimate of the day for the e1RM metric', () => {
    const s = buildProgressSeries(
      [set('2026-03-01', 200, 1, 200), set('2026-03-01', 185, 5, 215)],
      'e1rm',
    );
    expect(s.points[0].value).toBe(215);
  });

  it('reports first, latest, best and the change between the ends', () => {
    const s = buildProgressSeries(
      [set('2026-03-01', 100, 1, 100), set('2026-03-08', 140, 1, 140), set('2026-03-15', 120, 1, 120)],
      'e1rm',
    );
    expect(s.first).toBe(100);
    expect(s.latest).toBe(120);
    expect(s.best).toBe(140);
    expect(s.bestIndex).toBe(1);
    expect(s.change).toBe(20);
    expect(s.changePct).toBeCloseTo(0.2);
  });

  it('reports a decline as a negative change', () => {
    const s = buildProgressSeries(
      [set('2026-03-01', 200, 1, 200), set('2026-03-08', 180, 1, 180)],
      'e1rm',
    );
    expect(s.change).toBe(-20);
    expect(s.changePct).toBeCloseTo(-0.1);
  });

  it('pads the axis rather than starting at zero, so small gains stay visible', () => {
    const s = buildProgressSeries(
      [set('2026-03-01', 185, 1, 185), set('2026-03-08', 205, 1, 205)],
      'e1rm',
    );
    expect(s.min).toBeGreaterThan(0);
    expect(s.min).toBeLessThan(185);
    expect(s.max).toBeGreaterThan(205);
  });

  it('still produces a drawable band when every session is identical', () => {
    const s = buildProgressSeries(
      [set('2026-03-01', 100, 1, 100), set('2026-03-08', 100, 1, 100)],
      'e1rm',
    );
    expect(s.max).toBeGreaterThan(s.min);
    expect(s.change).toBe(0);
  });

  it('drops days that produced no value and ignores undated sets', () => {
    const s = buildProgressSeries(
      [set('2026-03-01', 0, 5, 0), set('', 100, 5), set('2026-03-08', 100, 5)],
      'topSet',
    );
    expect(s.points).toHaveLength(1);
    expect(s.points[0].date).toBe('2026-03-08');
  });

  it('offers exactly three metrics, each with a label', () => {
    expect(PROGRESS_METRICS).toHaveLength(3);
    for (const m of PROGRESS_METRICS) expect(m.label.length).toBeGreaterThan(0);
  });
});

describe('niceTicks', () => {
  it('produces round numbers inside the range', () => {
    const ticks = niceTicks(0, 100);
    expect(ticks.length).toBeGreaterThan(1);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(100);
    }
  });

  it('does not leave floating-point dust in the labels', () => {
    for (const t of niceTicks(0.1, 0.9)) {
      expect(String(t).length).toBeLessThan(8);
    }
  });

  it('returns nothing for an inverted or degenerate range', () => {
    expect(niceTicks(100, 100)).toEqual([]);
    expect(niceTicks(100, 50)).toEqual([]);
    expect(niceTicks(Number.NaN, 10)).toEqual([]);
  });

  it('rises monotonically', () => {
    const ticks = niceTicks(137, 892);
    for (let i = 1; i < ticks.length; i += 1) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
  });
});

describe('buildChartGeometry', () => {
  const series = buildProgressSeries(
    [
      set('2026-03-01', 100, 1, 100),
      set('2026-03-08', 120, 1, 120),
      set('2026-03-15', 140, 1, 140),
    ],
    'e1rm',
  );

  it('plots every point inside the padded box', () => {
    const g = buildChartGeometry(series, 300, 200, PADDING);
    expect(g.plotted).toHaveLength(3);
    for (const p of g.plotted) {
      expect(p.x).toBeGreaterThanOrEqual(PADDING.left);
      expect(p.x).toBeLessThanOrEqual(300 - PADDING.right);
      expect(p.y).toBeGreaterThanOrEqual(PADDING.top);
      expect(p.y).toBeLessThanOrEqual(200 - PADDING.bottom);
    }
  });

  it('puts a higher value higher on the screen', () => {
    const g = buildChartGeometry(series, 300, 200, PADDING);
    expect(g.plotted[2].y).toBeLessThan(g.plotted[0].y);
  });

  it('spans the full plot width from first to last', () => {
    const g = buildChartGeometry(series, 300, 200, PADDING);
    expect(g.plotted[0].x).toBeCloseTo(PADDING.left);
    expect(g.plotted[2].x).toBeCloseTo(300 - PADDING.right);
  });

  it('starts the path with a move and closes the area to the baseline', () => {
    const g = buildChartGeometry(series, 300, 200, PADDING);
    expect(g.path.startsWith('M')).toBe(true);
    expect(g.areaPath.endsWith('Z')).toBe(true);
    expect(g.areaPath).toContain(String(g.baselineY));
  });

  it('centres a lone point and draws no area under it', () => {
    const one = buildProgressSeries([set('2026-03-01', 100, 1, 100)], 'e1rm');
    const g = buildChartGeometry(one, 300, 200, PADDING);
    expect(g.plotted).toHaveLength(1);
    expect(g.plotted[0].x).toBeCloseTo(PADDING.left + g.plotWidth / 2);
    expect(g.areaPath).toBe('');
  });

  it('returns an empty geometry rather than NaN before layout has a width', () => {
    const g = buildChartGeometry(series, 0, 0, PADDING);
    expect(g.plotted).toEqual([]);
    expect(g.path).toBe('');
    expect(g.gridLines).toEqual([]);
  });

  it('returns an empty geometry for an empty series', () => {
    const g = buildChartGeometry(buildProgressSeries([], 'e1rm'), 300, 200, PADDING);
    expect(g.plotted).toEqual([]);
  });

  it('draws a flat series mid-box instead of dividing by zero', () => {
    const flat = buildProgressSeries(
      [set('2026-03-01', 100, 1, 100), set('2026-03-08', 100, 1, 100)],
      'e1rm',
    );
    const g = buildChartGeometry(flat, 300, 200, PADDING);
    for (const p of g.plotted) expect(Number.isFinite(p.y)).toBe(true);
    expect(g.plotted[0].y).toBeCloseTo(g.plotted[1].y);
  });

  it('places gridlines inside the plot', () => {
    const g = buildChartGeometry(series, 300, 200, PADDING);
    for (const line of g.gridLines) {
      expect(line.y).toBeGreaterThanOrEqual(PADDING.top - 0.01);
      expect(line.y).toBeLessThanOrEqual(200 - PADDING.bottom + 0.01);
    }
  });
});

describe('nearestIndex', () => {
  const series = buildProgressSeries(
    [
      set('2026-03-01', 100, 1, 100),
      set('2026-03-08', 120, 1, 120),
      set('2026-03-15', 140, 1, 140),
    ],
    'e1rm',
  );
  const geometry = buildChartGeometry(series, 300, 200, PADDING);

  it('snaps to the closest point', () => {
    expect(nearestIndex(geometry, geometry.plotted[1].x)).toBe(1);
    expect(nearestIndex(geometry, geometry.plotted[1].x + 5)).toBe(1);
  });

  it('clamps to the ends when the finger goes past them', () => {
    expect(nearestIndex(geometry, -500)).toBe(0);
    expect(nearestIndex(geometry, 5000)).toBe(2);
  });

  it('returns -1 for an empty chart', () => {
    expect(nearestIndex(buildChartGeometry(buildProgressSeries([], 'e1rm'), 300, 200, PADDING), 10)).toBe(
      -1,
    );
  });
});

describe('progressSummary', () => {
  const build = (values: number[]) =>
    buildProgressSeries(
      values.map((v, i) => set(`2026-03-0${i + 1}`, v, 1, v)),
      'e1rm',
    );

  it('says nothing has been logged for an empty series', () => {
    expect(progressSummary(build([]), 'lb')).toBe('No working sets logged yet.');
  });

  it('asks for a second session when there is only one', () => {
    expect(progressSummary(build([100]), 'lb')).toContain('One session');
  });

  it('reports a rise', () => {
    expect(progressSummary(build([100, 120]), 'lb')).toBe('Up 20 lb (+20%) across 2 sessions.');
  });

  it('reports a fall', () => {
    expect(progressSummary(build([120, 100]), 'lb')).toBe('Down 20 lb (-17%) across 2 sessions.');
  });

  it('reports no change without a direction', () => {
    expect(progressSummary(build([100, 100]), 'lb')).toBe('No change across 2 sessions.');
  });

  it('uses the unit it is given', () => {
    expect(progressSummary(build([100, 120]), 'kg')).toContain('kg');
  });

  it('never predicts or prescribes', () => {
    const wording = progressSummary(build([100, 120]), 'lb');
    for (const word in { should: 1, will: 1, expect: 1, recommend: 1 }) {
      expect(wording.toLowerCase()).not.toContain(word);
    }
  });
});

describe('shortDate', () => {
  it('formats a calendar date without drifting a day across time zones', () => {
    expect(shortDate('2026-03-04')).toMatch(/Mar\s*4|4\s*Mar/);
  });

  it('passes through anything it cannot parse', () => {
    expect(shortDate('nonsense')).toBe('nonsense');
  });
});
