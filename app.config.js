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

module.exports = ({ config }) => {
  const isDev = process.env.APP_VARIANT === 'development';
  const base = {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
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
