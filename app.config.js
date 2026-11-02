/**
 * App config. Every setting lives in app.json; this file adds one fix-up for
 * all builds and adjusts development builds, so "Rust Strength Dev" installs
 * next to the real app on the same phone instead of replacing it.
 *
 * EAS sets APP_VARIANT from the build profile in eas.json. Production and
 * preview builds otherwise get app.json unchanged.
 */
const { withInfoPlist } = require('expo/config-plugins');

/**
 * expo-task-manager declares the "fetch" background mode for every app that
 * installs it. Rust Strength never fetches in the background; it only needs
 * "location" (recording a run with the screen locked) and "audio" (spoken
 * splits). App Review asks about background modes an app does not use, so
 * this one is removed.
 */
const withoutBackgroundFetch = (config) =>
  withInfoPlist(config, (c) => {
    const modes = c.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) c.modResults.UIBackgroundModes = modes.filter((m) => m !== 'fetch');
    return c;
  });

/**
 * expo-dev-client adds a local-network (Bonjour) entry so the dev app can find
 * the dev server on your PC. Store builds have no dev server to find.
 */
const withoutDevServerDiscovery = (config) =>
  withInfoPlist(config, (c) => {
    delete c.modResults.NSBonjourServices;
    delete c.modResults.NSLocalNetworkUsageDescription;
    return c;
  });

/**
 * Sign in with Google needs Google's iOS client id, which differs between the
 * real app and the dev app (each is tied to its bundle id). It comes from the
 * EAS environment as EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID; Google's sheet returns
 * to the app on that id reversed. A build without one leaves Google out, and
 * the app then doesn't offer it (src/lib/socialSignIn.ts).
 */
function googleSignIn(clientId) {
  const suffix = '.apps.googleusercontent.com';
  if (!clientId || !clientId.endsWith(suffix)) return [];
  const iosUrlScheme = `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
  return [['@react-native-google-signin/google-signin', { iosUrlScheme }]];
}

module.exports = ({ config }) => {
  const isDev = process.env.APP_VARIANT === 'development';
  const base = {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ...googleSignIn(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
      withoutBackgroundFetch,
      ...(isDev ? [] : [withoutDevServerDiscovery]),
    ],
  };
  if (!isDev) return base;
  return {
    ...base,
    name: 'Rust Strength Dev',
    scheme: 'ruststrength-dev',
    ios: { ...base.ios, bundleIdentifier: 'com.ruststrength.app.dev' },
    android: { ...base.android, package: 'com.ruststrength.app.dev' },
  };
};
