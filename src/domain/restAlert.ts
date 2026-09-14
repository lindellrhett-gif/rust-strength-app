/**
 * The "rest over" notification, as pure decisions.
 *
 * It is a local notification: the phone schedules it against the rest timer's
 * deadline and delivers it itself. Nothing is sent to a server, nothing needs a
 * signal, and no device token is ever created or stored.
 *
 * There is only ever one of these pending. Starting, nudging or skipping the
 * timer all resolve to the same question — should a notification be waiting
 * for this deadline, and if so, how far away is it — which is what
 * `restAlertPlan` answers.
 */

import { restLabel } from './restTimer';

/** One fixed id, so scheduling again replaces the pending alert, never adds one. */
export const REST_ALERT_ID = 'rest-timer-over';

/** Device storage key for the opt-in. Per phone, because permission is per phone. */
export const REST_ALERT_SETTING_KEY = 'rest-alert-enabled';

/**
 * Deadlines closer than this are left to the in-app buzz. A notification that
 * lands a second after scheduling is noise, and it would arrive while the user
 * is almost certainly still looking at the timer.
 */
export const MIN_ALERT_LEAD_SECONDS = 3;

export type RestAlertPlan = { kind: 'cancel' } | { kind: 'schedule'; seconds: number };

export interface RestAlertInput {
  /** The timer's deadline, or null when it is idle. */
  endsAtMs: number | null;
  /** Already reached zero — the in-app alert has fired, so no notification. */
  finished: boolean;
  /** The user has switched the alert on. */
  enabled: boolean;
  /** Someone is signed in. Signing out must not leave an alert pending. */
  signedIn: boolean;
  nowMs: number;
}

export function restAlertPlan(input: RestAlertInput): RestAlertPlan {
  const { endsAtMs, finished, enabled, signedIn, nowMs } = input;
  if (!enabled || !signedIn || finished || endsAtMs == null) return { kind: 'cancel' };
  if (!Number.isFinite(endsAtMs) || !Number.isFinite(nowMs)) return { kind: 'cancel' };

  const seconds = Math.ceil((endsAtMs - nowMs) / 1000);
  if (seconds < MIN_ALERT_LEAD_SECONDS) return { kind: 'cancel' };
  return { kind: 'schedule', seconds };
}

/**
 * What the notification says. Plain and factual: it reports that the time the
 * user chose has elapsed, and makes no claim about recovery or readiness.
 */
export function restAlertContent(totalSeconds: number): { title: string; body: string } {
  return {
    title: 'Rest over',
    body: `Your ${restLabel(totalSeconds)} rest is up.`,
  };
}

/** Where notification permission stands, collapsed to what the settings row needs. */
export type AlertPermission = 'granted' | 'ask' | 'blocked';

export function alertPermission(granted: boolean, canAskAgain: boolean): AlertPermission {
  if (granted) return 'granted';
  return canAskAgain ? 'ask' : 'blocked';
}
