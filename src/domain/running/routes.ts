/**
 * Comparing attempts at a saved route. Pure, no I/O.
 */

export interface Attempt {
  activityId: string;
  performedAt: string;
  name: string | null;
  movingSeconds: number;
  distanceM: number;
}

export interface RankedAttempt extends Attempt {
  /** 1 for the fastest. Equal times share a rank. */
  rank: number;
  /** Seconds slower than the fastest; 0 for the fastest. */
  behindBest: number;
}

/** Attempts fastest first, each with its rank and gap to the best. */
export function rankAttempts(attempts: readonly Attempt[]): RankedAttempt[] {
  const sorted = [...attempts].sort(
    (a, b) => a.movingSeconds - b.movingSeconds || a.performedAt.localeCompare(b.performedAt),
  );
  const best = sorted[0]?.movingSeconds ?? 0;
  let rank = 0;
  let previous: number | null = null;
  return sorted.map((a, i) => {
    if (a.movingSeconds !== previous) rank = i + 1;
    previous = a.movingSeconds;
    return { ...a, rank, behindBest: a.movingSeconds - best };
  });
}

/** "Fastest of 4", "2nd of 4", or null for a run that isn't an attempt. */
export function attemptPlace(ranked: readonly RankedAttempt[], activityId: string): string | null {
  const mine = ranked.find((a) => a.activityId === activityId);
  if (!mine) return null;
  const of = ranked.length;
  if (of === 1) return 'First time on this route';
  if (mine.rank === 1) return `Fastest of ${of}`;
  const suffix = mine.rank % 10 === 1 && mine.rank !== 11 ? 'st' : mine.rank % 10 === 2 && mine.rank !== 12 ? 'nd' : mine.rank % 10 === 3 && mine.rank !== 13 ? 'rd' : 'th';
  return `${mine.rank}${suffix} of ${of}`;
}
