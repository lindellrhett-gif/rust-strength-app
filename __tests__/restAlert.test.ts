import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  MIN_ALERT_LEAD_SECONDS,
  REST_ALERT_ID,
  alertPermission,
  restAlertContent,
  restAlertPlan,
  type RestAlertInput,
} from '../src/domain/restAlert';

const NOW = 1_700_000_000_000;

const base: RestAlertInput = {
  endsAtMs: NOW + 90_000,
  finished: false,
  enabled: true,
  signedIn: true,
  nowMs: NOW,
};

describe('restAlertPlan', () => {
  it('schedules for the time left on a running timer', () => {
    expect(restAlertPlan(base)).toEqual({ kind: 'schedule', seconds: 90 });
  });

  it('rounds a part second up so the alert never lands before the timer ends', () => {
    expect(restAlertPlan({ ...base, endsAtMs: NOW + 89_001 })).toEqual({
      kind: 'schedule',
      seconds: 90,
    });
  });

  it('follows a nudged deadline', () => {
    expect(restAlertPlan({ ...base, endsAtMs: NOW + 105_000 })).toEqual({
      kind: 'schedule',
      seconds: 105,
    });
  });

  it('cancels when the user has not switched it on', () => {
    expect(restAlertPlan({ ...base, enabled: false })).toEqual({ kind: 'cancel' });
  });

  it('cancels when nobody is signed in', () => {
    expect(restAlertPlan({ ...base, signedIn: false })).toEqual({ kind: 'cancel' });
  });

  it('cancels when the timer is idle or skipped', () => {
    expect(restAlertPlan({ ...base, endsAtMs: null })).toEqual({ kind: 'cancel' });
  });

  it('cancels once the timer has finished in the app', () => {
    expect(restAlertPlan({ ...base, finished: true })).toEqual({ kind: 'cancel' });
  });

  it('leaves deadlines that are nearly up to the in-app buzz', () => {
    const tooSoon = NOW + (MIN_ALERT_LEAD_SECONDS - 1) * 1000;
    expect(restAlertPlan({ ...base, endsAtMs: tooSoon })).toEqual({ kind: 'cancel' });
    const justEnough = NOW + MIN_ALERT_LEAD_SECONDS * 1000;
    expect(restAlertPlan({ ...base, endsAtMs: justEnough })).toEqual({
      kind: 'schedule',
      seconds: MIN_ALERT_LEAD_SECONDS,
    });
  });

  it('cancels a deadline already in the past', () => {
    expect(restAlertPlan({ ...base, endsAtMs: NOW - 5_000 })).toEqual({ kind: 'cancel' });
  });

  it('cancels on nonsense input rather than scheduling something odd', () => {
    expect(restAlertPlan({ ...base, endsAtMs: Number.NaN })).toEqual({ kind: 'cancel' });
    expect(restAlertPlan({ ...base, nowMs: Number.POSITIVE_INFINITY })).toEqual({
      kind: 'cancel',
    });
  });
});

describe('restAlertContent', () => {
  it('names the rest length the user chose', () => {
    expect(restAlertContent(45)).toEqual({ title: 'Rest over', body: 'Your 45s rest is up.' });
    expect(restAlertContent(90).body).toBe('Your 1:30 rest is up.');
    expect(restAlertContent(120).body).toBe('Your 2 min rest is up.');
    expect(restAlertContent(135).body).toBe('Your 2:15 rest is up.');
  });
});

describe('alertPermission', () => {
  it('collapses the platform answer to what the settings row needs', () => {
    expect(alertPermission(true, false)).toBe('granted');
    expect(alertPermission(true, true)).toBe('granted');
    expect(alertPermission(false, true)).toBe('ask');
    expect(alertPermission(false, false)).toBe('blocked');
  });
});

it('uses one fixed id so a new alert replaces the old one', () => {
  expect(REST_ALERT_ID).toMatch(/^[a-z-]+$/);
});

/**
 * The privacy policy says no push token or device identifier is ever created.
 * That is only true while nothing asks for one, so this keeps it true: adding
 * real push notifications has to go through the policy first.
 */
describe('no push tokens', () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  it('never requests an Expo or device push token', () => {
    const offenders = ['app', 'src']
      .flatMap(walk)
      .filter((file) =>
        /getExpoPushTokenAsync|getDevicePushTokenAsync|addPushTokenListener/.test(
          readFileSync(file, 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });

  it('keeps every expo-notifications call inside one file', () => {
    const importers = ['app', 'src']
      .flatMap(walk)
      .filter((file) => /from 'expo-notifications'/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(/\\/g, '/'));
    expect(importers).toEqual(['src/lib/restNotifications.ts']);
  });
});
