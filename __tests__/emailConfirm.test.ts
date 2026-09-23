import { readFileSync } from 'node:fs';

import {
  RESEND_COOLDOWN_SECONDS,
  codeSentTo,
  confirmCodeProblem,
  confirmErrorMessage,
  normalizeCode,
} from '../src/domain/emailConfirm';
import { UNCONFIRMED_MESSAGE } from '../src/domain/authErrors';

describe('confirmation codes', () => {
  it('accepts a 6-digit code, however it was pasted', () => {
    expect(confirmCodeProblem('123456')).toBeNull();
    expect(confirmCodeProblem(' 123 456 ')).toBeNull();
    expect(confirmCodeProblem('123-456')).toBeNull();
    expect(normalizeCode('123-456')).toBe('123456');
  });

  it('asks for the code when it is missing or too short', () => {
    expect(confirmCodeProblem('')).toMatch(/6-digit code/);
    expect(confirmCodeProblem('12345')).toMatch(/6-digit code/);
    expect(confirmCodeProblem('abcdef')).toMatch(/6-digit code/);
  });

  it('names the address the code went to', () => {
    expect(codeSentTo('  Rhett@Example.com ')).toMatch('rhett@example.com');
    expect(codeSentTo('a@b.co')).toMatch(/spam/);
  });

  it('gives the user a way forward for every failure', () => {
    expect(confirmErrorMessage({ code: 'otp_expired' })).toMatch(/Send a new one, or sign in/);
    expect(confirmErrorMessage({ message: 'Token has expired or is invalid' })).toMatch(
      /wrong or has expired/,
    );
    expect(confirmErrorMessage({ status: 429 })).toMatch(/Wait a minute/);
    expect(confirmErrorMessage({ message: 'Error sending confirmation email' })).toMatch(
      /could not send the email/i,
    );
    expect(confirmErrorMessage({ message: 'Network request failed' })).toMatch(/No connection/);
    expect(confirmErrorMessage(null)).toMatch(/Something went wrong/);
  });

  it('keeps the resend cooldown Supabase expects', () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
  });

  it('tells an unconfirmed signer-in to use a code, not a link', () => {
    expect(UNCONFIRMED_MESSAGE).toMatch(/code/);
    expect(UNCONFIRMED_MESSAGE).not.toMatch(/link/i);
  });
});

describe('the confirmation email template', () => {
  const template = readFileSync('supabase/email-templates/confirm-signup.html', 'utf8');

  it('sends the code', () => {
    expect(template).toMatch(/\{\{ \.Token \}\}/);
  });

  it('carries no link, which a scanner would use up before the user', () => {
    expect(template).not.toMatch(/ConfirmationURL/);
    expect(template).not.toMatch(/<a /);
  });

  it('names no expiry, so changing the setting cannot make it wrong', () => {
    expect(template).not.toMatch(/\d+\s*(hour|minute|day)/i);
  });
});
