/**
 * The units a new account starts with, from the phone's region settings.
 * Pure, no I/O; src/lib/deviceUnits.ts reads the settings.
 *
 * Only a starting point. The weight unit is saved on the profile when the
 * account is created (migration 0028) and run distance follows it (see
 * running/units.ts); the energy unit applies until the person saves diary
 * settings of their own. Both can be changed in the app at any time.
 */

export interface StartingUnits {
  weight: 'lb' | 'kg';
  energy: 'kcal' | 'kj';
}

/** Where food labels lead with kilojoules and people count in them. */
const KILOJOULE_REGIONS = new Set(['AU', 'NZ']);

/**
 * `measurementSystem` is iOS's setting under Language & Region: 'us', 'uk'
 * or 'metric'. The UK counts as metric here, since most UK gyms load plates
 * in kilograms; that also means kilometres for runs. Anything unknown starts
 * in the US units the app has always used.
 */
export function startingUnits(measurementSystem: string | null, regionCode: string | null): StartingUnits {
  return {
    weight: measurementSystem === 'metric' || measurementSystem === 'uk' ? 'kg' : 'lb',
    energy: regionCode != null && KILOJOULE_REGIONS.has(regionCode.toUpperCase()) ? 'kj' : 'kcal',
  };
}
