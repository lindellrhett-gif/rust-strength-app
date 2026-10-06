/**
 * What the location permission means for recording a run. Pure, no I/O: the
 * screen reads the phone's answer and asks this what to do with it.
 */

export type LocationAccess =
  /** Precise location while using the app: ready to record. */
  | 'granted'
  /** Allowed, but only approximate location: useless for a run. */
  | 'approximate'
  /** Never asked yet. */
  | 'undetermined'
  /** Refused; only the Settings app can change it now. */
  | 'denied'
  /** Location Services are off for the whole phone. */
  | 'services-off';

/** The fields of expo-location's permission response this needs. */
export interface PermissionLike {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain?: boolean;
  ios?: { accuracy?: 'full' | 'reduced' };
}

export function locationAccess(permission: PermissionLike, servicesEnabled: boolean): LocationAccess {
  if (!servicesEnabled) return 'services-off';
  if (permission.status === 'granted') {
    return permission.ios?.accuracy === 'reduced' ? 'approximate' : 'granted';
  }
  if (permission.status === 'undetermined' || permission.canAskAgain) return 'undetermined';
  return 'denied';
}

/** What to tell the runner, or null when nothing needs saying. */
export function accessMessage(access: LocationAccess): { title: string; body: string; settings: boolean } | null {
  switch (access) {
    case 'granted':
    case 'undetermined':
      return null;
    case 'approximate':
      return {
        title: 'Turn on Precise Location',
        body: 'Approximate location is only accurate to a few kilometres, which is not enough to measure a run. In Settings, open Rust Strength, then Location, and turn on Precise Location.',
        settings: true,
      };
    case 'denied':
      return {
        title: 'Location is off for Rust Strength',
        body: 'Recording a run needs your location while the app is in use. In Settings, open Rust Strength, then Location, and choose While Using the App.',
        settings: true,
      };
    case 'services-off':
      return {
        title: 'Location Services are off',
        body: 'Turn on Location Services in Settings, under Privacy & Security, to record a run.',
        settings: false,
      };
  }
}
