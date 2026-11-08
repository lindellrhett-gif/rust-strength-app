/**
 * What to tell someone whose friend request didn't go through. The database
 * refuses a request across a block (migration 0032) with a row-level security
 * error, and a second request to the same person with a unique-key error.
 * Neither raw message means anything to a person, and the first mustn't say
 * that a block is the reason.
 */
export function friendRequestError(error: { code?: string; message?: string }): string {
  if (error.code === '42501') return "You can't send a request to this person.";
  if (error.code === '23505') return 'You already have a request with this person. Pull down to refresh.';
  return error.message || 'Please try again.';
}
