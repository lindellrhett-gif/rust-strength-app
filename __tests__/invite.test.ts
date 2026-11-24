import { APP_STORE_URL, inviteMessage } from '@/domain/invite';

describe('inviteMessage', () => {
  test('names your username once you have chosen one, then the App Store link', () => {
    expect(inviteMessage({ username: 'heavy_lifter', usernameChosen: true })).toBe(
      `I'm training with Rust Strength. Add me as a friend: @heavy_lifter\n${APP_STORE_URL}`,
    );
  });

  test('leaves out a username you have not chosen', () => {
    const message = inviteMessage({ username: 'user_8f3a2c', usernameChosen: false });
    expect(message).not.toContain('user_8f3a2c');
    expect(message).toBe(`I'm training with Rust Strength. Join me and add me as a friend.\n${APP_STORE_URL}`);
  });

  test('works before the profile has loaded', () => {
    expect(inviteMessage()).toContain(APP_STORE_URL);
    expect(inviteMessage({ username: '', usernameChosen: true })).not.toContain('@');
  });

  test('links to the Rust Strength listing', () => {
    expect(APP_STORE_URL).toBe('https://apps.apple.com/app/rust-strength/id6811736131');
  });
});
