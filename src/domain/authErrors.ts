/**
 * Recognising sign-in failures that need something other than "try again".
 */

interface AuthErrorLike {
  code?: string;
  message?: string;
}

function asAuthError(error: unknown): AuthErrorLike {
  return typeof error === 'object' && error !== null ? (error as AuthErrorLike) : {};
}

/**
 * The account exists and the password was right, but the email has not been
 * confirmed yet. Worth telling apart: the fix is in their inbox, not in what
 * they typed.
 */
export function isUnconfirmedEmail(error: unknown): boolean {
  const e = asAuthError(error);
  return (
    e.code === 'email_not_confirmed' || (e.message ?? '').toLowerCase().includes('email not confirmed')
  );
}

export const UNCONFIRMED_MESSAGE =
  'Your email is not confirmed yet. Enter the code we emailed you when you signed up. Cannot find it? Ask for a new one below.';
