import { randomUUID } from 'expo-crypto';

/**
 * A row id generated on the phone rather than by the database.
 *
 * This is what lets a workout logged with no signal work at all. If the server
 * assigned the id, a set could not name the workout it belongs to until that
 * workout had reached the server, so nothing could be queued behind it. With
 * the id decided here, a whole session can be built offline and replayed in
 * order later.
 *
 * It also makes a replay safe to repeat: re-inserting the same id conflicts on
 * the primary key instead of quietly creating a second copy of the set.
 */
export function newId(): string {
  return randomUUID();
}
