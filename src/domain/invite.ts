/**
 * Inviting someone to Rust Strength from the Friends tab: the text the share
 * sheet sends. Nothing about the invite reaches our servers; the person picks
 * where it goes (Messages, WhatsApp, a copied link) in Apple's share sheet.
 */
import { LEGAL } from '@/legal/config';

/** The App Store listing. Opens in the right country's store for whoever taps it. */
export const APP_STORE_URL = 'https://apps.apple.com/app/rust-strength/id6811736131';

/**
 * What the invite says. Your @username goes in only once you have chosen one,
 * so a friend who installs the app can search for you straight away; before
 * that it is a random handle nobody would recognise.
 */
export function inviteMessage(me: { username?: string | null; usernameChosen?: boolean } = {}): string {
  const handle = me.usernameChosen && me.username ? me.username.trim() : '';
  const lines = [
    handle
      ? `I'm training with ${LEGAL.appName}. Add me as a friend: @${handle}`
      : `I'm training with ${LEGAL.appName}. Join me and add me as a friend.`,
    APP_STORE_URL,
  ];
  return lines.join('\n');
}
