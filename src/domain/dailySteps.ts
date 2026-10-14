/**
 * Sharing daily step totals with friends, for the steps leaderboard and the
 * steps trophy. Off unless the person turns it on; while it's on, the app
 * uploads one total per day for the last week, which is as far back as the
 * iPhone keeps them.
 */

/** How many days the phone keeps, and so how many are uploaded each time. */
export const STEP_DAYS = 7;

/** A phone total above this is a fault, not a day's walking; the server refuses it too. */
export const MAX_DAILY_STEPS = 100_000;

export interface StepDay {
  /** Local date, YYYY-MM-DD. */
  day: string;
  /** Epoch milliseconds: local midnight, and the next midnight or now if sooner. */
  start: number;
  end: number;
}

function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today and the days before it, each from local midnight to the next (or now). */
export function stepDays(now: Date, count = STEP_DAYS): StepDay[] {
  const out: StepDay[] = [];
  for (let back = 0; back < count; back++) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back + 1);
    out.push({ day: localDate(start), start: start.getTime(), end: Math.min(next.getTime(), now.getTime()) });
  }
  return out;
}

/** What to upload: the days the phone could count, within believable bounds. */
export function stepsPayload(days: readonly StepDay[], counts: readonly (number | null)[]): { day: string; steps: number }[] {
  return days
    .map((d, i) => ({ day: d.day, steps: counts[i] }))
    .filter((d): d is { day: string; steps: number } => d.steps != null && Number.isFinite(d.steps) && d.steps >= 0)
    .map((d) => ({ day: d.day, steps: Math.min(MAX_DAILY_STEPS, Math.round(d.steps)) }));
}
