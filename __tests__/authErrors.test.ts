import { isUnconfirmedEmail } from '../src/domain/authErrors';

describe('isUnconfirmedEmail', () => {
  it('recognises Supabase’s unconfirmed-email error by code or message', () => {
    expect(isUnconfirmedEmail({ code: 'email_not_confirmed' })).toBe(true);
    expect(isUnconfirmedEmail({ message: 'Email not confirmed' })).toBe(true);
  });

  it('leaves other failures alone', () => {
    expect(isUnconfirmedEmail({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      false,
    );
    expect(isUnconfirmedEmail(new Error('Network request failed'))).toBe(false);
    expect(isUnconfirmedEmail(undefined)).toBe(false);
    expect(isUnconfirmedEmail('Email not confirmed')).toBe(false);
  });
});
