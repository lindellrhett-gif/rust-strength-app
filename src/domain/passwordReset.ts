/**
 * Forgotten-password reset, as pure rules.
 *
 * The reset uses a one-time code typed into the app rather than a link. A link
 * has to open the app from the email, which fails whenever the email is read on
 * a laptop, and needs deep-link and redirect configuration that can silently
 * break. A code works wherever the email is read.
 */

/** Matches the sign-up rule, so a reset can never set a password sign-up would refuse. */
export const MIN_PASSWORD_LENGTH = 8;

/** How long "Resend code" stays disabled. Supabase refuses repeat sends inside a minute anyway. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Supabase issues 6-digit codes by default and allows up to 10 if configured. */
const CODE_PATTERN = /^\d{6,10}$/;

/** People paste codes with spaces or dashes from the email; keep only the digits. */
export function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Deliberately loose: the server is the real check, this only catches typos. */
export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(raw));
}

export interface NewPasswordInput {
  code: string;
  password: string;
  confirm: string;
  /** The code has already been accepted and only the password update remains. */
  codeAlreadyVerified: boolean;
}

/** The first problem with the form, or null when it can be submitted. */
export function newPasswordProblem(input: NewPasswordInput): string | null {
  if (!input.codeAlreadyVerified && !CODE_PATTERN.test(normalizeCode(input.code))) {
    return 'Enter the code from the email.';
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (input.password !== input.confirm) {
    return 'The two passwords do not match.';
  }
  return null;
}

/**
 * Shown after "Send code" whether or not the address has an account. Saying
 * "no account found" would let anyone test which emails are signed up.
 */
export function codeSentMessage(email: string): string {
  return `If ${normalizeEmail(email)} has an account, a code is on its way. It can take a minute, so check your spam folder too.`;
}

interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

/** Turns an auth error into something a person can act on. */
export function resetErrorMessage(error: unknown): string {
  const e = (typeof error === 'object' && error !== null ? error : {}) as AuthErrorLike;
  const message = (e.message ?? '').toLowerCase();

  // Matched on "token" rather than "invalid": an email Supabase cannot parse
  // also says "invalid", and blaming the code for that would send people the
  // wrong way.
  if (e.code === 'otp_expired' || message.includes('token')) {
    return 'That code is wrong or has expired. Check it, or send a new one.';
  }
  if (e.code === 'email_address_invalid' || e.code === 'validation_failed') {
    return 'That email address does not look right.';
  }
  if (
    e.status === 429 ||
    e.code === 'over_email_send_rate_limit' ||
    e.code === 'over_request_rate_limit' ||
    message.includes('rate limit')
  ) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (e.code === 'weak_password' || message.includes('weak')) {
    return 'That password is too easy to guess. Try a longer one.';
  }
  if (e.code === 'same_password' || message.includes('different from the old')) {
    return 'Choose a password different from your old one.';
  }
  // Supabase accepted the request but its email sender failed — almost always
  // the SMTP settings or the template. Nothing the user can fix, so say so.
  if (message.includes('error sending')) {
    return `We could not send the email right now. Please try again later.`;
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'No connection. Check your signal and try again.';
  }
  return 'Something went wrong. Please try again.';
}
