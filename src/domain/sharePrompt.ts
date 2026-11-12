/**
 * When to ask someone whether to share their sessions with friends.
 *
 * Sharing starts off for new accounts: Quebec's Law 25 (s 9.1) and the UK
 * Children's Code both ask for the most private setting by default. A feed
 * nobody joins is no use, though, so the app asks once, at the moment it
 * becomes meaningful: when the person has their first accepted friend.
 *
 * `share_choice_at` records that they have answered (or set the switch in
 * Profile themselves). The prompt never nags: one answer, either way, and it
 * is gone. Accounts that turned sharing off before the column existed were
 * marked as having chosen by migration 0030, so they are not asked either.
 */

export interface SharePromptProfile {
  share_workouts: boolean;
  /**
   * When they last chose. Undefined while the database has no such column
   * yet (an older backend); the prompt then stays hidden.
   */
  share_choice_at?: string | null;
}

export function shouldAskToShare(
  profile: SharePromptProfile | null | undefined,
  acceptedFriends: number,
): boolean {
  if (!profile) return false;
  if (profile.share_workouts) return false;
  if (profile.share_choice_at !== null) return false;
  return acceptedFriends > 0;
}

/**
 * The fields to save when someone sets sharing, from the prompt or from the
 * Profile switch. The choice time goes only to a backend that has the column,
 * so an older one does not reject the whole update.
 */
export function shareChoice(
  on: boolean,
  profile: SharePromptProfile | null | undefined,
  now: Date = new Date(),
): { share_workouts: boolean; share_choice_at?: string } {
  return profile && 'share_choice_at' in profile
    ? { share_workouts: on, share_choice_at: now.toISOString() }
    : { share_workouts: on };
}
