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
 * Battery: the most accurate setting, with every fix delivered (about one a
 * second). GPS is the main cost of a run (not yet measured on a real run),
 * and accurate splits and records are the point of the feature. A distance filter would barely save power, since the GPS stays on
 * either way, and it would hide stops: with no fixes coming in, standing still
 * looks the same as losing signal. Tracking runs only between Start and
 * Finish; nothing is tracked otherwise.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { locationAccess, type LocationAccess } from '@/domain/running/permission';
import type { IncomingFix } from '@/domain/running/activeRunStore';

import { endRunActivity, initRunActivity, startRunActivity, syncRunActivity } from './runActivity';
import { maybeAnnounce } from './runCues';
import { runStore } from './runStore';

export const RUN_LOCATION_TASK = 'rust-strength.run-location';

/**
 * When this copy of the app started. A run found on the phone that was
 * recording before this moment was interrupted by the app closing.
 */
export const LAUNCHED_AT = Date.now();

export function toIncomingFix(l: Location.LocationObject): IncomingFix {
  return {
    lat: l.coords.latitude,
    lon: l.coords.longitude,
    alt: l.coords.altitude ?? null,
    t: l.timestamp,
    accuracy: l.coords.accuracy ?? null,
    altAccuracy: l.coords.altitudeAccuracy ?? null,
    // iOS reports -1 when it has no speed reading.
    speed: l.coords.speed != null && l.coords.speed >= 0 ? l.coords.speed : null,
  };
}

TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(RUN_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  // The store drops anything that arrives while paused or before the countdown ends.
  await runStore.append(data.locations.map(toIncomingFix));
  try {
    maybeAnnounce(runStore.current());
    syncRunActivity(runStore.current());
  } catch {
    // A missed announcement or Lock Screen update must never cost a fix.
  }
});

// The Lock Screen activity follows the run from launch on, like the task.
initRunActivity();

/**
 * Starts GPS for the run in the store, and shows it on the Lock Screen.
 * Always called from the open app: iOS starts background location, and Live
 * Activities, only from the foreground. Safe to call again mid-run.
 */
export async function startRunTracking(): Promise<void> {
  if (!(await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK))) await startLocation();
  void startRunActivity();
}

async function startLocation(): Promise<void> {
  await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.Fitness,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Recording your run',
      notificationBody: 'Rust Strength is measuring your distance and pace.',
    },
  });
}

export async function stopRunTracking(): Promise<void> {
  void endRunActivity();
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
