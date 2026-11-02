/**
 * Revoking Sign in with Apple when an account is deleted, which Apple
 * requires of every app that offers it. Plain TypeScript with no Deno APIs,
 * so Jest tests it (__tests__/appleRevoke.test.ts); delete-account signs the
 * client secret and sends the requests.
 *
 * The app sends a fresh one-time code from Apple with the deletion request.
 * delete-account trades it for the app's tokens and revokes them at once, so
 * no Apple token is ever stored.
 */

/** The app ids Apple issues codes to: the real app and the dev app. */
export const APPLE_CLIENT_IDS: readonly string[] = ['com.ruststrength.app', 'com.ruststrength.app.dev'];

export const APPLE_AUDIENCE = 'https://appleid.apple.com';
export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
export const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

/** How long a client secret lasts, in seconds; it is made fresh for each deletion. */
export const CLIENT_SECRET_LIFETIME = 300;

export function isAppleClientId(id: unknown): id is string {
  return typeof id === 'string' && APPLE_CLIENT_IDS.includes(id);
}

/** The claims of the client secret, a JWT signed (ES256) with the Sign in with Apple key. */
export function clientSecretClaims(teamId: string, clientId: string, nowSeconds: number) {
  return {
    iss: teamId,
    sub: clientId,
    aud: APPLE_AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + CLIENT_SECRET_LIFETIME,
  };
}

/** The form for trading the one-time code for the app's tokens. */
export function tokenRequestBody(clientId: string, clientSecret: string, code: string): string {
  return new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  }).toString();
}

/** The form for revoking the app's refresh token, which ends its access. */
export function revokeRequestBody(clientId: string, clientSecret: string, refreshToken: string): string {
  return new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token: refreshToken,
    token_type_hint: 'refresh_token',
  }).toString();
}

/**
 * The Apple account an ID token is for. The signature isn't checked: this is
 * only used on a token Apple has just handed over directly, over HTTPS.
 */
export function idTokenSubject(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  const payload = idToken.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}

interface IdentityLike {
  provider: string;
  id?: string;
  identity_data?: Record<string, unknown> | null;
}

/** The Apple account linked to a Supabase user, or null if it has none. */
export function appleAccountId(user: { identities?: IdentityLike[] | null } | null | undefined): string | null {
  const identity = user?.identities?.find((i) => i.provider === 'apple');
  if (!identity) return null;
  const sub = identity.identity_data?.sub;
  if (typeof sub === 'string' && sub) return sub;
  return identity.id ?? null;
}
