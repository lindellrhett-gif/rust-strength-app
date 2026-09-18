import { readFileSync } from 'node:fs';

import { consentHeading, materialVersion, needsConsent } from '../src/domain/consent';

const confirmed = '2026-09-01T00:00:00Z';

describe('materialVersion', () => {
  it('reads major.minor, with or without a patch', () => {
    expect(materialVersion('1.4.0')).toEqual([1, 4]);
    expect(materialVersion('2.0')).toEqual([2, 0]);
  });

  it('rejects anything else', () => {
    expect(materialVersion(null)).toBeNull();
    expect(materialVersion('')).toBeNull();
    expect(materialVersion('v1.4')).toBeNull();
    expect(materialVersion('1')).toBeNull();
  });
});

describe('needsConsent', () => {
  it('asks when nothing was ever recorded', () => {
    expect(needsConsent({ termsVersion: null, ageConfirmedAt: null }, '1.4.0')).toBe(true);
  });

  it('asks when the age confirmation is missing', () => {
    expect(needsConsent({ termsVersion: '1.4.0', ageConfirmedAt: null }, '1.4.0')).toBe(true);
  });

  it('does not ask again for the current version', () => {
    expect(needsConsent({ termsVersion: '1.4.0', ageConfirmedAt: confirmed }, '1.4.0')).toBe(false);
  });

  it('does not ask again for a patch change', () => {
    expect(needsConsent({ termsVersion: '1.4.0', ageConfirmedAt: confirmed }, '1.4.3')).toBe(false);
  });

  it('asks again after a minor or major change', () => {
    expect(needsConsent({ termsVersion: '1.3.1', ageConfirmedAt: confirmed }, '1.4.0')).toBe(true);
    expect(needsConsent({ termsVersion: '1.9.0', ageConfirmedAt: confirmed }, '2.0.0')).toBe(true);
  });

  it('does not ask a user who accepted a newer version than this build knows', () => {
    expect(needsConsent({ termsVersion: '1.5.0', ageConfirmedAt: confirmed }, '1.4.0')).toBe(false);
  });

  it('asks when the stored version is unreadable', () => {
    expect(needsConsent({ termsVersion: 'garbage', ageConfirmedAt: confirmed }, '1.4.0')).toBe(true);
  });

  it('never locks everyone out over a malformed app version', () => {
    expect(needsConsent({ termsVersion: '1.4.0', ageConfirmedAt: confirmed }, 'oops')).toBe(false);
  });
});

describe('consentHeading', () => {
  it('distinguishes a first acceptance from an update', () => {
    expect(consentHeading({ termsVersion: null, ageConfirmedAt: null })).toMatch(/Before/);
    expect(consentHeading({ termsVersion: '1.3.0', ageConfirmedAt: confirmed })).toMatch(/updated/);
  });
});

it('the app version is one the check can read', () => {
  const config = readFileSync('src/legal/config.ts', 'utf8');
  const version = /version: '([^']+)'/.exec(config)?.[1];
  expect(materialVersion(version)).not.toBeNull();
});
