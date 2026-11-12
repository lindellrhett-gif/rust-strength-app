import { hasAppleSignIn, isNewAccount, signInProviders, socialSignInMessage } from '@/domain/socialAuth';

describe('signInProviders', () => {
  it('reads the providers Supabase lists on the account', () => {
    expect(signInProviders({ app_metadata: { provider: 'email', providers: ['email', 'google'] } })).toEqual([
      'email',
      'google',
    ]);
  });

  it('includes linked identities, once each', () => {
    const user = { app_metadata: { provider: 'apple' }, identities: [{ provider: 'apple' }, { provider: 'email' }] };
    expect(signInProviders(user)).toEqual(['apple', 'email']);
  });

  it('is empty when signed out', () => {
    expect(signInProviders(null)).toEqual([]);
  });
});

describe('hasAppleSignIn', () => {
  it('spots an Apple sign-in however Supabase records it', () => {
    expect(hasAppleSignIn({ app_metadata: { providers: ['apple'] } })).toBe(true);
    expect(hasAppleSignIn({ identities: [{ provider: 'apple' }] })).toBe(true);
  });

  it('is false for email and Google accounts', () => {
    expect(hasAppleSignIn({ app_metadata: { providers: ['email', 'google'] } })).toBe(false);
  });
});

describe('isNewAccount', () => {
  it('is true when the account was made by this sign-in', () => {
    expect(
      isNewAccount({ created_at: '2026-11-02T18:00:00.000Z', last_sign_in_at: '2026-11-02T18:00:00.412Z' }),
    ).toBe(true);
  });

  it('is false when signing back in to an older account', () => {
    expect(
      isNewAccount({ created_at: '2026-09-01T10:00:00Z', last_sign_in_at: '2026-11-02T18:00:00Z' }),
    ).toBe(false);
  });

  it('is false when either time is missing', () => {
    expect(isNewAccount({ created_at: '2026-11-02T18:00:00Z', last_sign_in_at: null })).toBe(false);
    expect(isNewAccount(undefined)).toBe(false);
  });
});

describe('socialSignInMessage', () => {
  it('says the option is not ready when the provider is switched off', () => {
    expect(socialSignInMessage(new Error('Provider (issuer "https://accounts.google.com") is not enabled'), 'google')).toMatch(
      /isn't available yet/,
    );
    expect(socialSignInMessage(new Error('Unsupported provider: provider is not enabled'), 'apple')).toMatch(
      /Apple isn't available yet/,
    );
  });

  it('blames the connection for network failures', () => {
    expect(socialSignInMessage(new TypeError('Network request failed'), 'apple')).toMatch(/connection/);
  });

  it('falls back to a plain retry message', () => {
    expect(socialSignInMessage(new Error('Invalid nonce'), 'google')).toBe(
      "Couldn't sign in with Google. Please try again, or use your email.",
    );
  });
});
