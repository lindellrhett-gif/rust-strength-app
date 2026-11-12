/**
 * The phone's region setting (an ISO country code such as "DE"), used to pick
 * the minimum age (src/domain/age.ts).
 *
 * Privacy: the region never leaves the phone and is not saved anywhere.
 *
 * Loaded the same careful way as deviceUnits.ts: expo-localization needs its
 * native code the moment it is imported, so it is only required once Expo
 * confirms that code is in this build. Any failure gives null, which means
 * the general minimum age.
 */
import { requireOptionalNativeModule } from 'expo';

let cached: string | null | undefined;

export function deviceRegion(): string | null {
  if (cached === undefined) cached = read();
  return cached;
}

function read(): string | null {
  try {
    if (requireOptionalNativeModule('ExpoLocalization') == null) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    return getLocales()[0]?.regionCode ?? null;
  } catch {
    return null;
  }
}
