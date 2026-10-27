/**
 * Which features this person can use. Running, nutrition and the coach will
 * sit behind a subscription eventually; until there is one, everything is
 * available. Every entry point asks here, so adding the paywall later is a
 * change to this one function rather than a hunt through the screens.
 */

export type Feature = 'running';

// The parameter is unused until there is a paywall to check against.
export function hasFeature(feature: Feature): boolean {
  void feature;
  return true;
}
