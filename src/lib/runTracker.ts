/**
 * GPS for run recording, through iOS Core Location (expo-location).
 *
 * Location comes in through a background task rather than a foreground watch,
 * so recording carries on with the screen locked or the app in the
 * background. Started while the app is open, this needs only "While Using the
 * App" permission: iOS keeps delivering fixes and shows the blue location
 * indicator so the runner always knows tracking is on. It never asks for
 * "Always".
 *
 * The task must be defined at import time, in the global scope, so that when
 * iOS relaunches the app in the background to deliver fixes the task exists
 * before any screen renders. app/_layout.tsx imports this file for that.
 *
 * Battery: the most accurate setting with a 5 m distance filter. GPS is the
 * main cost of a run (roughly 8-12% of battery per hour on a recent iPhone),
 * and accurate splits and records are the point of the feature. It runs only
 * between Start and Finish; nothing is tracked otherwise.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { locationAccess, type LocationAccess } from '@/domain/running/permission';
import type { IncomingFix } from '@/domain/running/activeRunStore';

import { runStore } from './runStore';

export const RUN_LOCATION_TASK = 'rust-strength.run-location';

export function toIncomingFix(l: Location.LocationObject): IncomingFix {
  return {
    lat: l.coords.latitude,
    lon: l.coords.longitude,
    alt: l.coords.altitude ?? null,
    t: l.timestamp,
    accuracy: l.coords.accuracy ?? null,
    altAccuracy: l.coords.altitudeAccuracy ?? null,
  };
}

TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(RUN_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  // The store drops anything that arrives while paused or before the countdown ends.
  await runStore.append(data.locations.map(toIncomingFix));
});

export async function startRunTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.Fitness,
    distanceInterval: 5,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Recording your run',
      notificationBody: 'Rust Strength is measuring your distance and pace.',
    },
  });
}

export async function stopRunTracking(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
    }
  } catch {
    // Already stopped, or the task was never registered: nothing to do.
  }
}

export async function getLocationAccess(): Promise<LocationAccess> {
  const [permission, services] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
  ]);
  return locationAccess(permission, services);
}

export async function requestLocationAccess(): Promise<LocationAccess> {
  if (!(await Location.hasServicesEnabledAsync())) return 'services-off';
  return locationAccess(await Location.requestForegroundPermissionsAsync(), true);
}
