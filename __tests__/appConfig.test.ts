// app.config.js adds Google's native setup only for a build given its client id.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../app.config.js') as (ctx: { config: Record<string, unknown> }) => {
  plugins: unknown[];
  ios?: { bundleIdentifier?: string };
};

const config = { name: 'Rust Strength', plugins: ['expo-router'], ios: { bundleIdentifier: 'com.ruststrength.app' } };

const googlePlugin = (plugins: unknown[]) =>
  plugins.find((p) => Array.isArray(p) && p[0] === '@react-native-google-signin/google-signin') as
    | [string, { iosUrlScheme: string }]
    | undefined;

describe('app.config.js', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('leaves Google out of a build without a client id', () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    expect(googlePlugin(appConfig({ config }).plugins)).toBeUndefined();
  });

  it('returns to the app on the client id reversed', () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '123456-abcdef.apps.googleusercontent.com';
    expect(googlePlugin(appConfig({ config }).plugins)?.[1]).toEqual({
      iosUrlScheme: 'com.googleusercontent.apps.123456-abcdef',
    });
  });

  it('ignores something that is not a Google iOS client id', () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'not-a-client-id';
    expect(googlePlugin(appConfig({ config }).plugins)).toBeUndefined();
  });

  it('still gives the dev app its own bundle id', () => {
    process.env.APP_VARIANT = 'development';
    expect(appConfig({ config }).ios?.bundleIdentifier).toBe('com.ruststrength.app.dev');
  });
});
