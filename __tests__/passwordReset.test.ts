import {
  MIN_PASSWORD_LENGTH,
  codeSentMessage,
  looksLikeEmail,
  newPasswordProblem,
  normalizeCode,
  normalizeEmail,
  resetErrorMessage,
} from '../src/domain/passwordReset';

describe('normalizeCode', () => {
  it('keeps only digits, so pasted codes work', () => {
    expect(normalizeCode(' 123 456 ')).toBe('123456');
    expect(normalizeCode('123-456')).toBe('123456');
    expect(normalizeCode('abc')).toBe('');
  });
});

describe('email helpers', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Lifter@Example.COM ')).toBe('lifter@example.com');
  });

  it('catches obvious typos only', () => {
    expect(looksLikeEmail('a@b.co')).toBe(true);
    expect(looksLikeEmail(' someone+review@gmail.com ')).toBe(true);
    expect(looksLikeEmail('someone@gmail')).toBe(false);
    expect(looksLikeEmail('someone gmail.com')).toBe(false);
    expect(looksLikeEmail('')).toBe(false);
  });
});

describe('newPasswordProblem', () => {
  const ok = { code: '123456', password: 'longenough', confirm: 'longenough', codeAlreadyVerified: false };

  it('accepts a complete form', () => {
    expect(newPasswordProblem(ok)).toBeNull();
  });

  it('asks for the code first', () => {
    expect(newPasswordProblem({ ...ok, code: '' })).toMatch(/code/);
    expect(newPasswordProblem({ ...ok, code: '12345' })).toMatch(/code/);
    expect(newPasswordProblem({ ...ok, code: '12345678901' })).toMatch(/code/);
  });

  it('accepts a pasted code with spaces and longer configured codes', () => {
    expect(newPasswordProblem({ ...ok, code: '123 456' })).toBeNull();
    expect(newPasswordProblem({ ...ok, code: '12345678' })).toBeNull();
  });

  it('skips the code once it has already been accepted', () => {
    expect(newPasswordProblem({ ...ok, code: '', codeAlreadyVerified: true })).toBeNull();
  });

  it('uses the same minimum length as sign-up', () => {
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(newPasswordProblem({ ...ok, password: short, confirm: short })).toMatch(/at least 8/);
    const exact = 'x'.repeat(MIN_PASSWORD_LENGTH);
    expect(newPasswordProblem({ ...ok, password: exact, confirm: exact })).toBeNull();
  });

  it('requires the two passwords to match', () => {
    expect(newPasswordProblem({ ...ok, confirm: 'longenougH' })).toMatch(/match/);
  });
});

describe('codeSentMessage', () => {
  it('reads the same whether or not the account exists', () => {
    const message = codeSentMessage(' Someone@Example.com ');
    expect(message).toContain('someone@example.com');
    expect(message).toMatch(/^If /);
    expect(message).not.toMatch(/no account|not found|does not exist/i);
  });
});

describe('resetErrorMessage', () => {
  it('explains a wrong or expired code', () => {
    expect(resetErrorMessage({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toMatch(
      /wrong or has expired/,
    );
    expect(resetErrorMessage({ message: 'Token has expired or is invalid' })).toMatch(/expired/);
  });

  it('does not blame the code for a malformed email', () => {
    const message = resetErrorMessage({
      code: 'validation_failed',
      message: 'Unable to validate email address: invalid format',
    });
    expect(message).toMatch(/email address/);
    expect(message).not.toMatch(/code/);
  });

  it('explains rate limits', () => {
    expect(resetErrorMessage({ status: 429 })).toMatch(/Too many/);
    expect(resetErrorMessage({ code: 'over_email_send_rate_limit' })).toMatch(/Too many/);
    expect(resetErrorMessage({ message: 'email rate limit exceeded' })).toMatch(/Too many/);
  });

  it('explains password rules the server enforces', () => {
    expect(resetErrorMessage({ code: 'weak_password' })).toMatch(/too easy/);
    expect(resetErrorMessage({ code: 'same_password' })).toMatch(/different/);
  });

  it('does not blame the user when the email could not be sent', () => {
    const message = resetErrorMessage({
      status: 500,
      code: 'unexpected_failure',
      message: 'Error sending recovery email',
    });
    expect(message).toMatch(/could not send the email/);
  });

  it('explains a lost connection', () => {
    expect(resetErrorMessage(new TypeError('Network request failed'))).toMatch(/No connection/);
  });

  it('falls back to a generic message for anything else', () => {
    expect(resetErrorMessage(undefined)).toMatch(/Something went wrong/);
    expect(resetErrorMessage('boom')).toMatch(/Something went wrong/);
    expect(resetErrorMessage({ message: 'Database error' })).toMatch(/Something went wrong/);
  });
});
