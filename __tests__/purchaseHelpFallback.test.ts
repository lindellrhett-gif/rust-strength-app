/**
 * When RevenueCat's Customer Center can't open: subscribers get Apple's
 * subscription settings, and Lifetime owners, whose purchase isn't listed
 * there, get an email to support.
 */
const mockOpenURL = jest.fn(async () => true);
const mockShowManage = jest.fn(async () => undefined);
const mockPresent = jest.fn();

jest.mock('react-native', () => ({ Linking: { openURL: mockOpenURL }, Platform: { OS: 'ios' } }));
jest.mock('@/lib/env', () => ({ env: { subscriptionsSwitch: 'on', revenueCatIosKey: 'appl_test' } }));
jest.mock('@/domain/subscription', () => ({
  ...jest.requireActual('@/domain/subscription'),
  subscriptionsEnabled: () => true,
}));
jest.mock('react-native-purchases', () => ({ __esModule: true, default: { showManageSubscriptions: mockShowManage } }), {
  virtual: true,
});
jest.mock('react-native-purchases-ui', () => ({ __esModule: true, default: { presentCustomerCenter: mockPresent } }), {
  virtual: true,
});

// A release build, as on the phone.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- after the mocks above
const { openCustomerCenter, PURCHASE_HELP_MAILTO } = require('@/lib/purchases') as typeof import('@/lib/purchases');

beforeEach(() => {
  mockOpenURL.mockClear();
  mockShowManage.mockClear();
  mockPresent.mockReset();
});

test('waits for the Customer Center when it opens', async () => {
  mockPresent.mockResolvedValue(undefined);
  await expect(openCustomerCenter({ lifetime: true })).resolves.toBe('customerCenter');
  expect(mockOpenURL).not.toHaveBeenCalled();
  expect(mockShowManage).not.toHaveBeenCalled();
});

test('sends a Lifetime owner to support when it can’t open', async () => {
  mockPresent.mockRejectedValue(new Error('no proxy'));
  await expect(openCustomerCenter({ lifetime: true })).resolves.toBe('emailSupport');
  expect(mockOpenURL).toHaveBeenCalledWith(PURCHASE_HELP_MAILTO);
  expect(mockShowManage).not.toHaveBeenCalled();
  expect(PURCHASE_HELP_MAILTO).toBe('mailto:support@bluestemsoftware.com?subject=Rust%20Strength%20Pro%20purchase%20help');
});

test('sends a subscriber to Apple’s subscription settings when it can’t open', async () => {
  mockPresent.mockRejectedValue(new Error('no proxy'));
  await expect(openCustomerCenter()).resolves.toBe('manageSubscriptions');
  expect(mockShowManage).toHaveBeenCalledTimes(1);
  expect(mockOpenURL).not.toHaveBeenCalled();
});
