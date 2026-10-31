/**
 * The phone's region settings, through expo-localization, turned into the
 * units a new account starts with (src/domain/units.ts).
 *
 * Privacy: the region itself never leaves the phone. Only the unit it leads
 * to is saved, as the same preference the person can set in Profile.
 *
 * Fails soft: a build from before the module was added, or any error, gives
 * the US units the app always started with. expo-localization demands its
 * native code the moment it is imported, so, as in steps.ts, it is only
 * loaded once Expo confirms the native code is in this build.
 */
import { requireOptionalNativeModule } from 'expo';

import { startingUnits, type StartingUnits } from '@/domain/units';

let cached: StartingUnits | undefined;

export function deviceUnits(): StartingUnits {
  if (cached === undefined) cached = read();
  return cached;
}

function read(): StartingUnits {
  try {
    if (requireOptionalNativeModule('ExpoLocalization') == null) return startingUnits(null, null);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    const [first] = getLocales();
    return startingUnits(first?.measurementSystem ?? null, first?.regionCode ?? null);
  } catch {
    return startingUnits(null, null);
  }
}
