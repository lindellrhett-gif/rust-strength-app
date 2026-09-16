import { readFileSync } from 'node:fs';

/**
 * The iOS privacy manifest in app.json is plain strings, so a misspelt or
 * invented data type compiles, builds and ships — and simply declares nothing.
 * That happened once (`NSPrivacyCollectedDataTypeHealthAndFitness`, which does
 * not exist), leaving the app's workout data undeclared.
 *
 * The allowed values are Apple's list for NSPrivacyCollectedDataType and
 * NSPrivacyCollectedDataTypePurposes, copied from the developer documentation
 * on 16 September 2026.
 */

const DATA_TYPES = new Set([
  'NSPrivacyCollectedDataTypeName',
  'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypePhoneNumber',
  'NSPrivacyCollectedDataTypePhysicalAddress',
  'NSPrivacyCollectedDataTypeOtherUserContactInfo',
  'NSPrivacyCollectedDataTypeHealth',
  'NSPrivacyCollectedDataTypeFitness',
  'NSPrivacyCollectedDataTypePaymentInfo',
  'NSPrivacyCollectedDataTypeCreditInfo',
  'NSPrivacyCollectedDataTypeOtherFinancialInfo',
  'NSPrivacyCollectedDataTypePreciseLocation',
  'NSPrivacyCollectedDataTypeCoarseLocation',
  'NSPrivacyCollectedDataTypeSensitiveInfo',
  'NSPrivacyCollectedDataTypeContacts',
  'NSPrivacyCollectedDataTypeEmailsOrTextMessages',
  'NSPrivacyCollectedDataTypePhotosorVideos',
  'NSPrivacyCollectedDataTypeAudioData',
  'NSPrivacyCollectedDataTypeGameplayContent',
  'NSPrivacyCollectedDataTypeCustomerSupport',
  'NSPrivacyCollectedDataTypeOtherUserContent',
  'NSPrivacyCollectedDataTypeBrowsingHistory',
  'NSPrivacyCollectedDataTypeSearchHistory',
  'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeDeviceID',
  'NSPrivacyCollectedDataTypePurchaseHistory',
  'NSPrivacyCollectedDataTypeProductInteraction',
  'NSPrivacyCollectedDataTypeAdvertisingData',
  'NSPrivacyCollectedDataTypeOtherUsageData',
  'NSPrivacyCollectedDataTypeCrashData',
  'NSPrivacyCollectedDataTypePerformanceData',
  'NSPrivacyCollectedDataTypeOtherDiagnosticData',
  'NSPrivacyCollectedDataTypeEnvironmentScanning',
  'NSPrivacyCollectedDataTypeHands',
  'NSPrivacyCollectedDataTypeHead',
  'NSPrivacyCollectedDataTypeOtherDataTypes',
]);

const PURPOSES = new Set([
  'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising',
  'NSPrivacyCollectedDataTypePurposeDeveloperAdvertising',
  'NSPrivacyCollectedDataTypePurposeAnalytics',
  'NSPrivacyCollectedDataTypePurposeProductPersonalization',
  'NSPrivacyCollectedDataTypePurposeAppFunctionality',
  'NSPrivacyCollectedDataTypePurposeOther',
]);

interface CollectedType {
  NSPrivacyCollectedDataType: string;
  NSPrivacyCollectedDataTypeLinked: boolean;
  NSPrivacyCollectedDataTypeTracking: boolean;
  NSPrivacyCollectedDataTypePurposes: string[];
}

const manifest = JSON.parse(readFileSync('app.json', 'utf8')).expo.ios.privacyManifests;
const collected: CollectedType[] = manifest.NSPrivacyCollectedDataTypes;

describe('iOS privacy manifest', () => {
  it('uses only data types Apple defines', () => {
    const unknown = collected
      .map((entry) => entry.NSPrivacyCollectedDataType)
      .filter((type) => !DATA_TYPES.has(type));
    expect(unknown).toEqual([]);
  });

  it('uses only purposes Apple defines', () => {
    const unknown = collected
      .flatMap((entry) => entry.NSPrivacyCollectedDataTypePurposes)
      .filter((purpose) => !PURPOSES.has(purpose));
    expect(unknown).toEqual([]);
  });

  it('declares each type once', () => {
    const types = collected.map((entry) => entry.NSPrivacyCollectedDataType);
    expect(new Set(types).size).toBe(types.length);
  });

  it('declares what the privacy policy says the app collects', () => {
    const types = new Set(collected.map((entry) => entry.NSPrivacyCollectedDataType));
    for (const required of [
      'NSPrivacyCollectedDataTypeEmailAddress',
      'NSPrivacyCollectedDataTypeUserID',
      'NSPrivacyCollectedDataTypeFitness',
      'NSPrivacyCollectedDataTypeHealth',
      'NSPrivacyCollectedDataTypeOtherUserContent',
    ]) {
      expect(types).toContain(required);
    }
  });

  it('tracks nothing and uses data only to run the app', () => {
    expect(manifest.NSPrivacyTracking).toBe(false);
    for (const entry of collected) {
      expect(entry.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(entry.NSPrivacyCollectedDataTypePurposes).toEqual([
        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
      ]);
    }
  });
});
