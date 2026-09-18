import {
  DEFAULT_RETRIES,
  SESSION_RETRIES,
  SessionUnavailableError,
  isAnonymousDataRequest,
  requestUrl,
  retryDelay,
  shouldRetry,
} from '../src/lib/sessionGuard';

const ANON = 'anon-key';
const REST = 'https://example.supabase.co/rest/v1/workouts?id=eq.1';

describe('session guard', () => {
  it('flags a data request sent with the anon key', () => {
    expect(isAnonymousDataRequest(REST, `Bearer ${ANON}`, ANON)).toBe(true);
  });

  it('lets a data request with a user token through', () => {
    expect(isAnonymousDataRequest(REST, 'Bearer user.jwt.token', ANON)).toBe(false);
  });

  it('leaves auth requests alone, which always carry the anon key', () => {
    const auth = 'https://example.supabase.co/auth/v1/token?grant_type=refresh_token';
    expect(isAnonymousDataRequest(auth, `Bearer ${ANON}`, ANON)).toBe(false);
  });

  it('covers RPC calls, which are data requests too', () => {
    const rpc = 'https://example.supabase.co/rest/v1/rpc/rpc_friend_leaderboard';
    expect(isAnonymousDataRequest(rpc, `Bearer ${ANON}`, ANON)).toBe(true);
  });

  it('retries a missing session for longer than other errors', () => {
    const session = new SessionUnavailableError();
    const other = new Error('boom');
    expect(shouldRetry(DEFAULT_RETRIES - 1, other)).toBe(true);
    expect(shouldRetry(DEFAULT_RETRIES, other)).toBe(false);
    expect(shouldRetry(DEFAULT_RETRIES, session)).toBe(true);
    expect(shouldRetry(SESSION_RETRIES, session)).toBe(false);
  });

  it('backs off to at most 15 seconds, about a minute in all', () => {
    expect(retryDelay(0)).toBe(1000);
    expect(retryDelay(1)).toBe(2000);
    expect(retryDelay(10)).toBe(15_000);
    const total = Array.from({ length: SESSION_RETRIES }, (_, i) => retryDelay(i)).reduce((a, b) => a + b);
    expect(total).toBeGreaterThanOrEqual(45_000);
    expect(total).toBeLessThanOrEqual(90_000);
  });

  it('reads the URL from each kind of fetch input', () => {
    expect(requestUrl(REST)).toBe(REST);
    expect(requestUrl(new URL(REST))).toBe(REST);
  });

  it('has a message a person can act on', () => {
    expect(new SessionUnavailableError().message).toMatch(/Try again/);
  });
});
