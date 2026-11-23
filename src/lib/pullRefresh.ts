import { useState } from 'react';

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

/**
 * Pull-to-refresh state that follows the person's own pull, not the query.
 *
 * A RefreshControl bound to a query's `isRefetching` also shows the spinner for
 * every background refetch: coming back to the app, a reconnect, a write on
 * this phone invalidating the list. iOS then drops the spinner in at the top
 * of the page unasked, and if that happens while the screen is off screen or
 * mid-transition it can stay stuck there. This only turns on with a pull, and
 * turns off when the refetches settle or after REFRESH_SPINNER_MS.
 */
export function usePullToRefresh(...refetchers: (() => Promise<unknown>)[]) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await settledOrAfter(Promise.allSettled(refetchers.map((refetch) => refetch())));
    setRefreshing(false);
  };

  return { refreshing, onRefresh: () => void onRefresh() };
}
