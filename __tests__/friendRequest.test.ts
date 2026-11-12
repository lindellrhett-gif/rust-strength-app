import { friendRequestError } from '../src/domain/friendRequest';

describe('friendRequestError', () => {
  it('turns a refused request into plain words, without naming a block', () => {
    const message = friendRequestError({ code: '42501', message: 'new row violates row-level security policy' });
    expect(message).toBe("You can't send a request to this person.");
    expect(message).not.toMatch(/block|security|policy/i);
  });

  it('explains a duplicate request', () => {
    expect(friendRequestError({ code: '23505' })).toMatch(/already have a request/);
  });

  it('passes anything else through', () => {
    expect(friendRequestError({ code: 'XX000', message: 'Network down' })).toBe('Network down');
    expect(friendRequestError({})).toBe('Please try again.');
  });
});
