import {
  APPLE_AUDIENCE,
  CLIENT_SECRET_LIFETIME,
  appleAccountId,
  clientSecretClaims,
  idTokenSubject,
  isAppleClientId,
  revokeRequestBody,
  tokenRequestBody,
} from '../supabase/functions/_shared/apple';

/** An unsigned token with the given payload, as base64url. */
function token(payload: object): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `eyJhbGciOiJSUzI1NiJ9.${b64}.signature`;
}

describe('isAppleClientId', () => {
  it('accepts the real app and the dev app only', () => {
    expect(isAppleClientId('com.ruststrength.app')).toBe(true);
    expect(isAppleClientId('com.ruststrength.app.dev')).toBe(true);
    expect(isAppleClientId('com.example.other')).toBe(false);
    expect(isAppleClientId(undefined)).toBe(false);
  });
});

describe('clientSecretClaims', () => {
  it('names the team, the app and Apple, and expires within minutes', () => {
    const claims = clientSecretClaims('TEAM123', 'com.ruststrength.app', 1_800_000_000);
    expect(claims).toEqual({
      iss: 'TEAM123',
      sub: 'com.ruststrength.app',
      aud: APPLE_AUDIENCE,
      iat: 1_800_000_000,
      exp: 1_800_000_000 + CLIENT_SECRET_LIFETIME,
    });
  });
});

describe('request bodies', () => {
  it('trades the code with the authorization_code grant', () => {
    const form = new URLSearchParams(tokenRequestBody('com.ruststrength.app', 'secret', 'c0de.with+chars'));
    expect(Object.fromEntries(form)).toEqual({
      client_id: 'com.ruststrength.app',
      client_secret: 'secret',
      code: 'c0de.with+chars',
      grant_type: 'authorization_code',
    });
  });

  it('revokes the refresh token', () => {
    const form = new URLSearchParams(revokeRequestBody('com.ruststrength.app', 'secret', 'r.123'));
    expect(form.get('token')).toBe('r.123');
    expect(form.get('token_type_hint')).toBe('refresh_token');
  });
});

describe('idTokenSubject', () => {
  it("reads the Apple account from Apple's token", () => {
    expect(idTokenSubject(token({ sub: '001234.abcdef.0987', aud: 'com.ruststrength.app' }))).toBe(
      '001234.abcdef.0987',
    );
  });

  it('is null for anything that is not a token with a subject', () => {
    expect(idTokenSubject('not-a-token')).toBeNull();
    expect(idTokenSubject(token({ aud: 'x' }))).toBeNull();
    expect(idTokenSubject(undefined)).toBeNull();
  });
});

describe('appleAccountId', () => {
  it("finds the Apple identity's account id", () => {
    const user = {
      identities: [
        { provider: 'email', id: 'u1', identity_data: { sub: 'u1' } },
        { provider: 'apple', id: '001234.abcdef.0987', identity_data: { sub: '001234.abcdef.0987' } },
      ],
    };
    expect(appleAccountId(user)).toBe('001234.abcdef.0987');
  });

  it('is null for an account without Sign in with Apple', () => {
    expect(appleAccountId({ identities: [{ provider: 'google', id: 'g1' }] })).toBeNull();
    expect(appleAccountId(null)).toBeNull();
  });
});
