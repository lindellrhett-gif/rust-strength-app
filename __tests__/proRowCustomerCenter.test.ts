/**
 * "Purchase help" / "Manage subscription" from the Rust Strength Pro sheet.
 *
 * RevenueCat presents its Customer Center from the window's root view
 * controller, and iOS refuses while our sheet is presented there, so the
 * button spun forever on 1.2.0. ProRow now closes the sheet, opens the
 * Customer Center once the sheet has gone, and reopens the sheet after.
 */
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockMutate = jest.fn();

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Pressable: 'Pressable',
  StyleSheet: { create: <T>(s: T) => s },
  Switch: 'Switch',
  Text: 'Text',
  View: 'View',
}));
jest.mock('@/components/Button', () => ({ Button: 'Button' }));
jest.mock('@/components/Field', () => ({ Field: 'Field' }));
jest.mock('@/components/NumberStepper', () => ({ NumberStepper: 'NumberStepper' }));
jest.mock('@/components/ProCard', () => ({ ProCard: 'ProCard' }));
jest.mock('@/components/RestAlertToggle', () => ({ RestAlertToggle: 'RestAlertToggle' }));
jest.mock('@/components/SettingRow', () => ({ SettingRow: 'SettingRow' }));
jest.mock('@/components/SettingsSheet', () => ({ SettingsSheet: 'SettingsSheet' }));
jest.mock('@/data/profile', () => ({ useUpdateProfile: () => ({ mutate: jest.fn() }) }));
jest.mock('@/data/subscription', () => ({
  useProStatus: () => ({ data: { active: true, lifetime: true } }),
  useCustomerCenter: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock('@/domain/generator', () => ({ EQUIPMENT_OPTIONS: [] }));
jest.mock('@/domain/inlineEdit', () => ({ parseInlineNumber: jest.fn() }));
jest.mock('@/domain/restTimer', () => ({ REST_PRESETS: [], clampRest: jest.fn(), restLabel: jest.fn() }));
jest.mock('@/theme/colors', () => ({ colors: {} }));
jest.mock('@/theme/typography', () => ({ radius: {}, spacing: {}, text: {} }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- after the mocks above
const { ProRow } = require('@/components/profile/ProfileSheets') as typeof import('@/components/profile/ProfileSheets');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(): ReactTestRenderer {
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(createElement(ProRow));
  });
  return tree!;
}

const sheet = (tree: ReactTestRenderer) => tree.root.findByType('SettingsSheet' as never);
const card = (tree: ReactTestRenderer) => tree.root.findByType('ProCard' as never);

function openSheetAndAskForHelp(tree: ReactTestRenderer) {
  act(() => tree.root.findByType('SettingRow' as never).props.onPress());
  expect(sheet(tree).props.visible).toBe(true);
  act(() => card(tree).props.onOpenCustomerCenter());
}

beforeEach(() => {
  mockMutate.mockReset();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

test('closes the sheet before opening the Customer Center, and only then opens it', () => {
  const tree = render();
  openSheetAndAskForHelp(tree);

  expect(sheet(tree).props.visible).toBe(false);
  expect(mockMutate).not.toHaveBeenCalled();

  act(() => sheet(tree).props.onDismiss());
  expect(mockMutate).toHaveBeenCalledTimes(1);

  // The fallback timer must not open it a second time.
  act(() => jest.advanceTimersByTime(2000));
  expect(mockMutate).toHaveBeenCalledTimes(1);
});

test('brings the sheet back when the Customer Center closes', () => {
  const tree = render();
  openSheetAndAskForHelp(tree);
  act(() => sheet(tree).props.onDismiss());

  const options = mockMutate.mock.calls[0][1] as { onSettled: () => void };
  act(() => options.onSettled());
  expect(sheet(tree).props.visible).toBe(true);
});

test('still opens the Customer Center if the sheet never reports closing', () => {
  const tree = render();
  openSheetAndAskForHelp(tree);

  act(() => jest.advanceTimersByTime(1499));
  expect(mockMutate).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1));
  expect(mockMutate).toHaveBeenCalledTimes(1);
});
