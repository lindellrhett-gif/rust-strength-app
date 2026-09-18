/**
 * Keeps a signed-in user's database requests from going out anonymously.
 *
 * The access token lasts an hour. Come back to the app after longer than that
 * and the first requests have to refresh it; if the phone's connection is not
 * back yet, the refresh fails and supabase-js quietly sends the request with
 * the public anon key instead. Row-level security then hides every row, so an
 * open workout comes back as "not found" and lists come back empty — wrong
 * answers that look like real ones.
 *
 * Refusing those requests turns the wrong answer into an error, which React
 * Query retries once the session is back. No imports from React Native, so it
 * can be tested.
 */

export class SessionUnavailableError extends Error {
  constructor() {
    super('Reconnecting to your account. Try again in a moment.');
    this.name = 'SessionUnavailableError';
  }
}

/** True for a database (PostgREST) request carrying the anon key rather than a user token. */
export function isAnonymousDataRequest(
  url: string,
  authorization: string | null,
  anonKey: string,
): boolean {
  return url.includes('/rest/v1/') && authorization === `Bearer ${anonKey}`;
}

/** How many times to retry after a failure; a missing session gets longer to come back. */
export const SESSION_RETRIES = 6;
export const DEFAULT_RETRIES = 2;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  const limit = error instanceof SessionUnavailableError ? SESSION_RETRIES : DEFAULT_RETRIES;
  return failureCount < limit;
}

/** 1s, 2s, 4s… capped at 15s: about a minute in all for a session to recover. */
export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 15_000);
}

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
