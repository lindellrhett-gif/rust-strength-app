/**
 * The row of people across the top of the Friends tab, and whose picture gets a
 * ring. A ring comes only from posts the viewer can already see in the feed, so
 * it says nothing about someone who keeps their sessions private.
 */

/** Gold for a new record today, blue for any other session today. */
export type Ring = 'record' | 'trained' | null;

export interface RowPost {
  userId: string;
  occurredAt: string;
  recordCount: number;
}

export interface RowFriend {
  otherUserId: string;
  username: string;
  displayName: string | null;
}

export interface RowEntry<F extends RowFriend = RowFriend> {
  friend: F;
  ring: Ring;
}

/** The ring for one person, given which instants count as today. */
export function ringFor(
  userId: string,
  posts: readonly RowPost[],
  isToday: (iso: string) => boolean,
): Ring {
  const today = posts.filter((p) => p.userId === userId && isToday(p.occurredAt));
  if (today.length === 0) return null;
  return today.some((p) => p.recordCount > 0) ? 'record' : 'trained';
}

const RING_ORDER: Record<'record' | 'trained' | 'none', number> = { record: 0, trained: 1, none: 2 };

/**
 * Friends with a ring first, records before the rest, then by username so the
 * row doesn't reshuffle between refreshes.
 */
export function friendsRow<F extends RowFriend>(
  friends: readonly F[],
  posts: readonly RowPost[],
  isToday: (iso: string) => boolean,
): RowEntry<F>[] {
  return friends
    .map((friend) => ({ friend, ring: ringFor(friend.otherUserId, posts, isToday) }))
    .sort(
      (a, b) =>
        RING_ORDER[a.ring ?? 'none'] - RING_ORDER[b.ring ?? 'none'] ||
        a.friend.username.localeCompare(b.friend.username),
    );
}
