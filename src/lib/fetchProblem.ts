/**
 * Why a fetch threw. Our own 10-second timeout aborts the request, and a slow
 * server isn't the same as no signal: that reads as `unavailable` ("try again
 * in a minute"), and only a failed connection reads as `offline`.
 */
export function fetchProblem(e: unknown): 'offline' | 'unavailable' {
  const name = e instanceof Error ? e.name : '';
  const message = e instanceof Error ? e.message : '';
  if (name === 'AbortError' || /abort/i.test(message)) return 'unavailable';
  return /network|failed to fetch/i.test(message) ? 'offline' : 'unavailable';
}
