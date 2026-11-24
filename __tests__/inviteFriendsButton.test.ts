/** The Invite friends button and header icon: what they hand the share sheet. */
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockShare = jest.fn();
const mockAlert = jest.fn();
let mockProfile: { username: string; username_chosen: boolean } | undefined;

jest.mock('react-native', () => ({
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
  Share: { share: (...args: unknown[]) => mockShare(...args) },
}));
jest.mock('@/components/Button', () => ({ Button: 'Button' }));
jest.mock('@/data/profile', () => ({ useProfile: () => ({ data: mockProfile }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- after the mocks above
const { InviteFriendsButton } = require('@/components/InviteFriendsButton') as typeof import('@/components/InviteFriendsButton');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- after the mocks above
const { APP_STORE_URL } = require('@/domain/invite') as typeof import('@/domain/invite');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function press() {
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(createElement(InviteFriendsButton));
  });
  const button = tree!.root.findByType('Button' as never);
  expect(button.props.label).toBe('Invite friends');
  await act(async () => {
    button.props.onPress();
  });
}

beforeEach(() => {
  mockShare.mockReset();
  mockAlert.mockReset();
  mockProfile = undefined;
});

test('shares the App Store link and your chosen username', async () => {
  mockProfile = { username: 'rhett', username_chosen: true };
  mockShare.mockResolvedValue({ action: 'sharedAction' });
  await press();

  expect(mockShare).toHaveBeenCalledTimes(1);
  const { message } = mockShare.mock.calls[0][0] as { message: string };
  expect(message).toContain('@rhett');
  expect(message).toContain(APP_STORE_URL);
  expect(mockAlert).not.toHaveBeenCalled();
});

test('leaves out a username you have not chosen yet', async () => {
  mockProfile = { username: 'user_8f3a2c', username_chosen: false };
  mockShare.mockResolvedValue({ action: 'dismissedAction' });
  await press();

  const { message } = mockShare.mock.calls[0][0] as { message: string };
  expect(message).not.toContain('user_8f3a2c');
  expect(mockAlert).not.toHaveBeenCalled();
});

test('says so when the share sheet can’t open', async () => {
  mockShare.mockRejectedValue(new Error('busy'));
  await press();
  expect(mockAlert).toHaveBeenCalledWith('Couldn’t open the share sheet', 'Please try again.');
});
