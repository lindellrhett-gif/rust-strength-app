/**
 * Confirming a new account's email with a code typed into the app.
 *
 * A link cannot be relied on. It works once, and mail apps and company security
 * scanners open links in messages before the person does, which uses the link
 * up and leaves them with "this link has expired". It also fails when the email
 * is read on a laptop and the app is on a phone. A code has neither problem.
 *
 * Shares its rules with the password reset, which already works this way.
 */

import { RESEND_COOLDOWN_SECONDS, normalizeCode, normalizeEmail, resetErrorMessage } from './passwordReset';

export { RESEND_COOLDOWN_SECONDS, normalizeCode, normalizeEmail };

/** Supabase issues 6-digit codes by default, and up to 10 if configured. */
const CODE_PATTERN = /^\d{6,10}$/;

/** Why the code cannot be submitted, or null when it can. */
export function confirmCodeProblem(code: string): string | null {
  return CODE_PATTERN.test(normalizeCode(code)) ? null : 'Enter the 6-digit code from the email.';
}

export function codeSentTo(email: string): string {
  return `We sent a 6-digit code to ${normalizeEmail(email)}. It can take a minute, and it may land in spam.`;
}

interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

/** Turns a confirmation error into something a person can act on. */
export function confirmErrorMessage(error: unknown): string {
  const e = (typeof error === 'object' && error !== null ? error : {}) as AuthErrorLike;
  const message = (e.message ?? '').toLowerCase();

  // A code that was already used reads the same as a wrong one, and an account
  // already confirmed has no code left to use — so say both.
  if (e.code === 'otp_expired' || message.includes('token') || message.includes('otp')) {
    return 'That code is wrong or has expired. Send a new one, or sign in if you already confirmed.';
  }
  if (message.includes('already') && message.includes('confirm')) {
    return 'This email is already confirmed. Sign in instead.';
  }
  return resetErrorMessage(error);
}
