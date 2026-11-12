/**
 * How long a pull-to-refresh spinner may stay up.
 *
 * With no signal a refetch pauses instead of failing, so its promise doesn't
 * settle until the connection returns, and a spinner tied to it would sit over
 * the screen for the whole dead spot. The refetch carries on regardless; only
 * the spinner stops waiting.
 */
export const REFRESH_SPINNER_MS = 4000;

/** Resolves when the work settles, or after `ms`, whichever comes first. */
export function settledOrAfter(work: Promise<unknown>, ms: number = REFRESH_SPINNER_MS): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    work.then(finish, finish);
  });
}
