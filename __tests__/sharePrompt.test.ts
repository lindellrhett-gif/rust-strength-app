import { shareChoice, shouldAskToShare } from '../src/domain/sharePrompt';

describe('shouldAskToShare', () => {
  const fresh = { share_workouts: false, share_choice_at: null };

  it('asks a new account once it has a friend', () => {
    expect(shouldAskToShare(fresh, 1)).toBe(true);
    expect(shouldAskToShare(fresh, 4)).toBe(true);
  });

  it('waits until there is a friend to share with', () => {
    expect(shouldAskToShare(fresh, 0)).toBe(false);
  });

  it('never asks someone who already shares', () => {
    expect(shouldAskToShare({ share_workouts: true, share_choice_at: null }, 3)).toBe(false);
  });

  it('never asks again after an answer either way', () => {
    expect(
      shouldAskToShare({ share_workouts: false, share_choice_at: '2026-11-07T10:00:00Z' }, 2),
    ).toBe(false);
  });

  it('stays hidden while the backend has no choice column', () => {
    expect(shouldAskToShare({ share_workouts: false }, 2)).toBe(false);
  });

  it('stays hidden before the profile loads', () => {
    expect(shouldAskToShare(undefined, 2)).toBe(false);
    expect(shouldAskToShare(null, 2)).toBe(false);
  });
});

describe('shareChoice', () => {
  const now = new Date('2026-11-07T12:00:00Z');

  it('records the answer and when it was given', () => {
    expect(shareChoice(true, { share_workouts: false, share_choice_at: null }, now)).toEqual({
      share_workouts: true,
      share_choice_at: '2026-11-07T12:00:00.000Z',
    });
    expect(shareChoice(false, { share_workouts: false, share_choice_at: null }, now)).toEqual({
      share_workouts: false,
      share_choice_at: '2026-11-07T12:00:00.000Z',
    });
  });

  it('leaves the time out for a backend without the column', () => {
    expect(shareChoice(false, { share_workouts: true }, now)).toEqual({ share_workouts: false });
    expect(shareChoice(true, undefined, now)).toEqual({ share_workouts: true });
  });
});
