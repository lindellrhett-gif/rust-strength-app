/**
 * The rest timer on the Lock Screen and in the Dynamic Island (an iOS Live
 * Activity): the countdown, and the next set.
 *
 * iOS counts down by itself from the rest's end, so the activity is only
 * updated when something changes: a rest starts, is nudged, ends early, or
 * the next set becomes known. When the time runs out with the phone locked,
 * the widget notices on its own (src/lib/restActivity.ts explains how).
 */
import { formatHold, formatSetSummary, type LoadType, type SetLoadFields } from './loadType';

/** What comes next, as the add-set screen knows it. */
export interface NextSet {
  /** "Bench Press" */
  exercise: string;
  /** The suggestion for the next set, or only the set just logged. */
  kind: 'next' | 'last';
  /** "185 lb × 6–8" */
  detail: string;
}

export interface RestActivityState {
  status: 'resting' | 'ready';
  /** Epoch milliseconds, for the countdown and its bar. */
  startedAt: number;
  endsAt: number;
  exercise: string;
  /** "Next set" or "Last set". */
  label: string;
  detail: string;
}

export interface RestTimerSnapshot {
  /** When the rest ends, or null with no rest running. */
  endsAt: number | null;
  /** What the rest was set to, in seconds. */
  totalSeconds: number;
  /** Reached zero (and not yet dismissed). */
  finished: boolean;
  signedIn: boolean;
}

/** The activity for the rest timer, or null when nothing should show. */
export function restActivityState(timer: RestTimerSnapshot, next: NextSet | null): RestActivityState | null {
  if (timer.endsAt == null || !timer.signedIn) return null;
  return {
    status: timer.finished ? 'ready' : 'resting',
    startedAt: Math.min(timer.endsAt, timer.endsAt - Math.max(1, timer.totalSeconds) * 1000),
    endsAt: timer.endsAt,
    exercise: next?.exercise ?? '',
    label: next?.kind === 'last' ? 'Last set' : 'Next set',
    detail: next?.detail ?? '',
  };
}

/** "6–8", or "8" when the range is a single number. */
function repRange(low: number, high: number): string {
  return low === high ? String(low) : `${low}–${high}`;
}

function trim(n: number): string {
  return Number(n.toFixed(1)).toString();
}

export interface UpcomingSet {
  loadType: LoadType;
  unit: string;
  /** Weighted: the weight on the bar. */
  weight: number;
  /** Assisted: the assistance. */
  assist: number;
  /** Bodyweight and timed: weight added on top. */
  added: number;
  /** Bodyweight: the reps to aim for. */
  reps: number;
  /** Timed: the hold to aim for. */
  holdSeconds: number;
  repLow: number;
  repHigh: number;
}

/** The set about to be done, as one line: "185 lb × 6–8", "BW + 25 lb × 10", "1:30 hold". */
export function upcomingSetDetail(s: UpcomingSet): string {
  switch (s.loadType) {
    case 'assisted':
      return `${s.assist > 0 ? `${trim(s.assist)} ${s.unit} assist` : 'No assist'} × ${repRange(s.repLow, s.repHigh)}`;
    case 'bodyweight':
      return `${s.added > 0 ? `BW + ${trim(s.added)} ${s.unit}` : 'BW'} × ${s.reps}`;
    case 'timed':
      return `${formatHold(s.holdSeconds)} hold${s.added > 0 ? ` + ${trim(s.added)} ${s.unit}` : ''}`;
    default:
      return `${trim(s.weight)} ${s.unit} × ${repRange(s.repLow, s.repHigh)}`;
  }
}

/** The set just logged, as one line, for when the next one isn't known yet. */
export function loggedSetDetail(set: SetLoadFields & { reps: number }, unit: string): string {
  return formatSetSummary(set, unit);
}
