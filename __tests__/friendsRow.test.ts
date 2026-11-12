import { friendsRow, ringFor } from '../src/domain/friendsRow';

const isToday = (iso: string) => iso.startsWith('2026-11-08');
const friend = (id: string, username = id) => ({ otherUserId: id, username, displayName: null });
const post = (userId: string, occurredAt: string, recordCount = 0) => ({ userId, occurredAt, recordCount });

describe('ringFor', () => {
  it('gives no ring without a session today', () => {
    expect(ringFor('a', [], isToday)).toBeNull();
    expect(ringFor('a', [post('a', '2026-11-07T23:00:00Z')], isToday)).toBeNull();
  });

  it('ignores other people’s sessions', () => {
    expect(ringFor('a', [post('b', '2026-11-08T10:00:00Z', 2)], isToday)).toBeNull();
  });

  it('is blue for a session today', () => {
    expect(ringFor('a', [post('a', '2026-11-08T10:00:00Z')], isToday)).toBe('trained');
  });

  it('is gold if any session today set a record', () => {
    const posts = [post('a', '2026-11-08T08:00:00Z'), post('a', '2026-11-08T18:00:00Z', 1)];
    expect(ringFor('a', posts, isToday)).toBe('record');
  });

  it('doesn’t count a record from another day', () => {
    const posts = [post('a', '2026-11-08T08:00:00Z'), post('a', '2026-11-07T18:00:00Z', 3)];
    expect(ringFor('a', posts, isToday)).toBe('trained');
  });
});

describe('friendsRow', () => {
  it('puts records first, then sessions, then everyone else', () => {
    const friends = [friend('quiet'), friend('lifter'), friend('champ')];
    const posts = [post('lifter', '2026-11-08T08:00:00Z'), post('champ', '2026-11-08T09:00:00Z', 1)];
    expect(friendsRow(friends, posts, isToday).map((e) => [e.friend.username, e.ring])).toEqual([
      ['champ', 'record'],
      ['lifter', 'trained'],
      ['quiet', null],
    ]);
  });

  it('orders by username within a group, so it doesn’t reshuffle', () => {
    const entries = friendsRow([friend('zed'), friend('amy')], [], isToday);
    expect(entries.map((e) => e.friend.username)).toEqual(['amy', 'zed']);
  });

  it('copes with nobody', () => {
    expect(friendsRow([], [], isToday)).toEqual([]);
  });
});
