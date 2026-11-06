/**
 * Sign in with Apple and Google: the parts that are plain logic. The native
 * sign-in sheets are in src/lib/socialSignIn.ts.
 */

export type SocialProvider = 'apple' | 'google';

/** The bits of a Supabase user these helpers read. */
export interface AuthUserLike {
  created_at?: string;
  last_sign_in_at?: string | null;
  app_metadata?: { provider?: unknown; providers?: unknown };
  identities?: { provider: string }[] | null;
}

/** Every way this account can sign in: "email", "apple", "google". */
export function signInProviders(user: AuthUserLike | null | undefined): string[] {
  if (!user) return [];
  const found = new Set<string>();
  const { provider, providers } = user.app_metadata ?? {};
  if (typeof provider === 'string') found.add(provider);
  if (Array.isArray(providers)) for (const p of providers) if (typeof p === 'string') found.add(p);
  for (const identity of user.identities ?? []) found.add(identity.provider);
  return [...found];
}

/**
 * Apple requires an app to revoke its Sign in with Apple tokens when the
 * account is deleted, so these accounts are deleted through the server.
 */
export function hasAppleSignIn(user: AuthUserLike | null | undefined): boolean {
  return signInProviders(user).includes('apple');
}

/** How close together creation and sign-in are for a brand-new account. */
const NEW_ACCOUNT_WINDOW_MS = 60_000;

/**
 * True when this sign-in just created the account, rather than signing back
 * in to one that already existed: Supabase stamps both times in the same
 * request for a new account.
 */
export function isNewAccount(user: AuthUserLike | null | undefined): boolean {
  const created = Date.parse(user?.created_at ?? '');
  const signedIn = Date.parse(user?.last_sign_in_at ?? '');
  if (Number.isNaN(created) || Number.isNaN(signedIn)) return false;
  return Math.abs(signedIn - created) < NEW_ACCOUNT_WINDOW_MS;
}

const NAMES: Record<SocialProvider, string> = { apple: 'Apple', google: 'Google' };

/** What to show when signing in with Apple or Google failed. */
export function socialSignInMessage(error: unknown, provider: SocialProvider): string {
  const name = NAMES[provider];
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  // Supabase: the provider isn't switched on (or not for this app's id).
  if (/provider.*(not enabled|disabled)|unsupported provider/i.test(message)) {
    return `Signing in with ${name} isn't available yet. Use your email for now.`;
  }
  if (/network|fetch|offline|timed? ?out/i.test(message)) {
    return `Couldn't reach ${name}. Check your connection and try again.`;
  }
  return `Couldn't sign in with ${name}. Please try again, or use your email.`;
}
