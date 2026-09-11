/**
 * Per-exercise progress over time — the series behind the chart you get by
 * tapping a personal record.
 *
 * Sets are collapsed to one point per training day, because two points on the
 * same afternoon say nothing about progress and make the line look like noise.
 * Geometry lives here too, so the chart component only draws what it is handed
 * and the awkward parts (a single session, a dead-flat line, a zero-width
 * canvas) are covered by tests rather than by luck.
 */

export type ProgressMetric = 'e1rm' | 'topSet' | 'volume';

export const PROGRESS_METRICS: { id: ProgressMetric; label: string; blurb: string }[] = [
  { id: 'e1rm', label: 'Est. 1RM', blurb: 'Best estimated one-rep max that day' },
  { id: 'topSet', label: 'Top set', blurb: 'Heaviest working set that day' },
  { id: 'volume', label: 'Volume', blurb: 'Total weight moved that day' },
];

/** A working set, with its local calendar date already resolved. */
export interface ProgressSet {
  /** Local date, YYYY-MM-DD. */
  date: string;
  weight: number;
  reps: number;
  e1rm: number;
}

export interface ProgressPoint {
  date: string;
  /** The metric's value for this day. */
  value: number;
  /** Working sets logged that day. */
  sets: number;
  topWeight: number;
  /** Reps of the heaviest set that day. */
  topReps: number;
}

export interface ProgressSeries {
  metric: ProgressMetric;
  points: ProgressPoint[];
  /** Bottom and top of the value axis, already padded for drawing. */
  min: number;
  max: number;
  first: number | null;
  latest: number | null;
  best: number | null;
  /** Index of the best point, or -1 when there are none. */
  bestIndex: number;
  /** Latest minus first, and the same as a fraction of first. */
  change: number | null;
  changePct: number | null;
}

const EMPTY: Omit<ProgressSeries, 'metric'> = {
  points: [],
  min: 0,
  max: 1,
  first: null,
  latest: null,
  best: null,
  bestIndex: -1,
  change: null,
  changePct: null,
};

function valueFor(metric: ProgressMetric, daySets: ProgressSet[]): number {
  if (metric === 'volume') {
    return daySets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  }
  if (metric === 'topSet') {
    return daySets.reduce((best, s) => Math.max(best, s.weight), 0);
  }
  return daySets.reduce((best, s) => Math.max(best, s.e1rm), 0);
}

/**
 * One point per training day, oldest first.
 *
 * The axis is padded by a tenth of the range rather than starting at zero: a
 * bench press that went 185 to 205 is a real change, and a zero-based axis
 * flattens it into a straight line.
 */
export function buildProgressSeries(
  sets: ProgressSet[],
  metric: ProgressMetric,
): ProgressSeries {
  const byDay = new Map<string, ProgressSet[]>();
  for (const set of sets) {
    if (!set.date) continue;
    const day = byDay.get(set.date);
    if (day) day.push(set);
    else byDay.set(set.date, [set]);
  }

  const points: ProgressPoint[] = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, daySets]) => {
      const heaviest = daySets.reduce((best, s) => (s.weight > best.weight ? s : best), daySets[0]);
      return {
        date,
        value: valueFor(metric, daySets),
        sets: daySets.length,
        topWeight: heaviest.weight,
        topReps: heaviest.reps,
      };
    })
    .filter((p) => p.value > 0);

  if (points.length === 0) return { metric, ...EMPTY };

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // A dead-flat series still needs a band to draw in.
  const span = rawMax - rawMin;
  const pad = span === 0 ? Math.max(1, rawMax * 0.1) : span * 0.1;

  const first = points[0].value;
  const latest = points[points.length - 1].value;
  const best = rawMax;
  const bestIndex = values.indexOf(best);

  return {
    metric,
    points,
    min: Math.max(0, rawMin - pad),
    max: rawMax + pad,
    first,
    latest,
    best,
    bestIndex,
    change: latest - first,
    changePct: first > 0 ? (latest - first) / first : null,
  };
}

// --- Geometry ---------------------------------------------------------------

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlottedPoint {
  index: number;
  x: number;
  y: number;
  point: ProgressPoint;
}

export interface GridLine {
  y: number;
  value: number;
}

export interface ChartGeometry {
  plotted: PlottedPoint[];
  /** SVG path for the line, empty when there is nothing to draw. */
  path: string;
  /** The same line closed down to the baseline, for the soft fill under it. */
  areaPath: string;
  gridLines: GridLine[];
  plotWidth: number;
  plotHeight: number;
  baselineY: number;
}

/** Round a range to 2-4 readable gridline values. */
export function niceTicks(min: number, max: number, target = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const rawStep = (max - min) / Math.max(1, target);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * magnitude);
  const step = candidates.find((c) => c >= rawStep) ?? candidates[candidates.length - 1];

  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    // Floating-point accumulation leaves values like 199.99999999999997.
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

export function buildChartGeometry(
  series: ProgressSeries,
  width: number,
  height: number,
  padding: ChartPadding,
): ChartGeometry {
  const plotWidth = Math.max(0, width - padding.left - padding.right);
  const plotHeight = Math.max(0, height - padding.top - padding.bottom);
  const baselineY = padding.top + plotHeight;

  const empty: ChartGeometry = {
    plotted: [],
    path: '',
    areaPath: '',
    gridLines: [],
    plotWidth,
    plotHeight,
    baselineY,
  };
  if (series.points.length === 0 || plotWidth <= 0 || plotHeight <= 0) return empty;

  const range = series.max - series.min;
  const toY = (value: number) =>
    padding.top + (range <= 0 ? plotHeight / 2 : (1 - (value - series.min) / range) * plotHeight);

  const count = series.points.length;
  const toX = (index: number) =>
    // A lone point sits in the middle rather than pinned to the left edge.
    count === 1 ? padding.left + plotWidth / 2 : padding.left + (index / (count - 1)) * plotWidth;

  const plotted: PlottedPoint[] = series.points.map((point, index) => ({
    index,
    x: toX(index),
    y: toY(point.value),
    point,
  }));

  const path = plotted
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`)
    .join(' ');

  const areaPath =
    plotted.length > 1
      ? `${path} L${round(plotted[plotted.length - 1].x)} ${round(baselineY)} ` +
        `L${round(plotted[0].x)} ${round(baselineY)} Z`
      : '';

  const gridLines = niceTicks(series.min, series.max).map((value) => ({
    y: toY(value),
    value,
  }));

  return { plotted, path, areaPath, gridLines, plotWidth, plotHeight, baselineY };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The point nearest an x position, for scrubbing. Returns -1 for an empty
 * chart. A finger is wider than a marker, so this matches on x alone rather
 * than asking anyone to hit a dot.
 */
export function nearestIndex(geometry: ChartGeometry, x: number): number {
  if (geometry.plotted.length === 0) return -1;
  let best = 0;
  let bestDistance = Infinity;
  for (const p of geometry.plotted) {
    const distance = Math.abs(p.x - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = p.index;
    }
  }
  return best;
}

// --- Wording ----------------------------------------------------------------

/**
 * A plain sentence about the trend.
 *
 * Deliberately descriptive, never predictive or prescriptive: it reports what
 * the numbers did and stops there.
 */
export function progressSummary(series: ProgressSeries, unit: string): string {
  if (series.points.length === 0) return 'No working sets logged yet.';
  if (series.points.length === 1) return 'One session logged. Log another to see a trend.';

  const change = series.change ?? 0;
  const rounded = Math.round(Math.abs(change) * 10) / 10;
  const sessions = `${series.points.length} sessions`;

  if (rounded === 0) return `No change across ${sessions}.`;
  const direction = change > 0 ? 'Up' : 'Down';
  const pct = series.changePct != null ? ` (${formatPct(series.changePct)})` : '';
  return `${direction} ${rounded} ${unit}${pct} across ${sessions}.`;
}

function formatPct(fraction: number): string {
  const pct = Math.round(Math.abs(fraction) * 100);
  return `${fraction >= 0 ? '+' : '-'}${pct}%`;
}

/** Short axis date, e.g. "4 Mar" rendered as "Mar 4". */
export function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
