/**
 * Whether a signed-in user must confirm the Terms, Privacy Policy and their
 * age before using the app.
 *
 * Two reasons it can be needed:
 *
 * 1. No record at all. Accounts created while email confirmation was on never
 *    had one saved, because consent was written only after an automatic
 *    sign-in that an unconfirmed email makes impossible.
 * 2. A material change. The privacy policy promises to ask users to accept a
 *    materially changed version. Versions are major.minor.patch: a major or
 *    minor bump is material, a patch (a typo, a new contact address) is not.
 */

export interface ConsentRecord {
  termsVersion: string | null;
  ageConfirmedAt: string | null;
}

/** [major, minor], or null for anything that is not a version number. */
export function materialVersion(version: string | null | undefined): [number, number] | null {
  const match = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec((version ?? '').trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

export function needsConsent(record: ConsentRecord, currentVersion: string): boolean {
  if (!record.ageConfirmedAt) return true;
  const accepted = materialVersion(record.termsVersion);
  const current = materialVersion(currentVersion);
  if (!accepted) return true;
  // An unreadable current version is a bug in the app, not the user's problem;
  // do not lock everyone out over it.
  if (!current) return false;
  return accepted[0] < current[0] || (accepted[0] === current[0] && accepted[1] < current[1]);
}

/**
 * The explicit consent to health information, asked separately from the Terms
 * on sign-up and on the consent screen. Required: recording training and
 * health is what the app does. The GDPR (Article 9(2)(a)) needs it to be
 * explicit for UK and EU users, Quebec's Law 25 for sensitive information, and
 * it is the alternative basis under Washington's My Health My Data Act.
 *
 * Accepting a documents version of 1.6.0 or later records it: no version from
 * then on can be accepted without ticking this box. The record of when and
 * which version is the profile's terms_accepted_at and terms_version.
 */
export const HEALTH_CONSENT_LABEL =
  'I consent to Rust Strength using my health information, such as my training, runs, steps, bodyweight and food diary, as the Privacy Policy describes';

/** The heading on the consent screen, which differs for a returning user. */
export function consentHeading(record: ConsentRecord): string {
  return record.termsVersion ? 'We updated our Terms and Privacy Policy' : 'Before you continue';
}
