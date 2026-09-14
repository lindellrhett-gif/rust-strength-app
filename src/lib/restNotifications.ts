import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';

import {
  REST_ALERT_ID,
  REST_ALERT_SETTING_KEY,
  alertPermission,
  type AlertPermission,
} from '@/domain/restAlert';

/**
 * The only file that talks to expo-notifications.
 *
 * Local notifications only. Nothing here asks for a push token, so no device
 * identifier is created, sent or stored anywhere.
 */

let handlerInstalled = false;

/**
 * While the app is open the timer already buzzes and changes state on screen,
 * so a banner on top would say the same thing twice. Called once at startup.
 */
export function installNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// --- Serialised scheduling ---------------------------------------------------
//
// Each call is async and several can arrive within a second (+15s tapped three
// times). Run them strictly in order, or an older schedule could land after a
// newer cancel and leave an alert pending for a rest the user skipped.

let queue: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task).catch(() => {
    // Best effort. A failed schedule loses a convenience, never data, and the
    // in-app timer still works — not worth an error on screen mid-workout.
  });
}

export function scheduleRestAlert(seconds: number, title: string, body: string): void {
  enqueue(async () => {
    await Notifications.cancelScheduledNotificationAsync(REST_ALERT_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: REST_ALERT_ID,
      content: { title, body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
  });
}

export function cancelRestAlert(): void {
  enqueue(async () => {
    await Notifications.cancelScheduledNotificationAsync(REST_ALERT_ID);
    // Also clear one that already arrived, so an old "Rest over" is not left
    // sitting in Notification Centre after the user has moved on.
    await Notifications.dismissNotificationAsync(REST_ALERT_ID);
  });
}

// --- Permission ----------------------------------------------------------------

export async function getAlertPermission(): Promise<AlertPermission> {
  const current = await Notifications.getPermissionsAsync();
  return alertPermission(current.granted, current.canAskAgain);
}

/** Shows the system prompt if iOS still allows it; otherwise just reports. */
export async function requestAlertPermission(): Promise<AlertPermission> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) {
    return alertPermission(current.granted, current.canAskAgain);
  }
  const answer = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return alertPermission(answer.granted, answer.canAskAgain);
}

// --- The opt-in ----------------------------------------------------------------
//
// Kept on the phone rather than the profile: notification permission belongs to
// a device, so a second phone should ask for itself. Off until switched on.

let enabled = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

let loaded = false;

/** Reads the saved choice once at startup. A failed read leaves it off. */
export function loadRestAlertSetting(): void {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(REST_ALERT_SETTING_KEY)
    .then((value) => {
      enabled = value === 'true';
      emit();
    })
    .catch(() => {});
}

export function setRestAlertEnabled(on: boolean): void {
  enabled = on;
  emit();
  AsyncStorage.setItem(REST_ALERT_SETTING_KEY, on ? 'true' : 'false').catch(() => {});
}

export function useRestAlertEnabled(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => enabled,
    () => false,
  );
}
